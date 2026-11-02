//! Motor de áudio em thread dedicada. O OutputStream do rodio não é Send,
//! então ele nasce e morre dentro da thread; a UI só conversa por canal (mpsc).
//! Assim o áudio nunca bloqueia a thread principal nem os webviews de vídeo.

use std::f32::consts::FRAC_PI_2;
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::domain::playback::LoopMode;
use crate::error::{AppError, AppResult};

const TICK: Duration = Duration::from_millis(30);
const PROGRESS_EVERY: Duration = Duration::from_millis(100);
const MAX_FADING: usize = 4;

pub enum AudioCmd {
    Play { path: PathBuf, crossfade_ms: u32, loop_mode: LoopMode, volume: f32 },
    Pause,
    Resume,
    Stop { fade_ms: u32 },
    SetVolume(f32),
    SetLoop(LoopMode),
}

/// Handle gerenciado pelo Tauri (State). Sender protegido por Mutex.
pub struct AudioHandle {
    tx: Mutex<Sender<AudioCmd>>,
}

impl AudioHandle {
    pub fn spawn(app: AppHandle) -> Self {
        let (tx, rx) = mpsc::channel();
        std::thread::Builder::new()
            .name("audio-engine".into())
            .spawn(move || run(app, rx))
            .expect("não foi possível iniciar a thread de áudio");
        Self { tx: Mutex::new(tx) }
    }

    pub fn send(&self, cmd: AudioCmd) -> AppResult<()> {
        self.tx
            .lock()
            .map_err(|_| AppError::StatePoisoned)?
            .send(cmd)
            .map_err(|_| AppError::Audio("motor de áudio encerrado".into()))
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProgressEvent {
    path: String,
    position_ms: u64,
    duration_ms: Option<u64>,
    playing: bool,
    /// Pico de amplitude (0..1) desde o último evento, já com ganho aplicado.
    level: f32,
}

#[derive(Serialize, Clone)]
struct EndedEvent {
    path: String,
}

struct Fade {
    start: Instant,
    dur: Duration,
    from: f32,
    to: f32,
}

struct Voice {
    sink: Sink,
    path: PathBuf,
    loop_mode: LoopMode,
    duration: Option<Duration>,
    started: Instant,
    paused_total: Duration,
    paused_at: Option<Instant>,
    fade: Option<Fade>,
    gain: f32,
    peak: Arc<AtomicU32>,
}

impl Voice {
    fn elapsed(&self) -> Duration {
        let end = self.paused_at.unwrap_or_else(Instant::now);
        end.saturating_duration_since(self.started)
            .saturating_sub(self.paused_total)
    }

    fn position_ms(&self) -> u64 {
        let el = self.elapsed().as_millis() as u64;
        match &self.loop_mode {
            LoopMode::Segment { start_ms, end_ms } if end_ms > start_ms => {
                start_ms + el % (end_ms - start_ms)
            }
            LoopMode::Track => match self.duration {
                Some(d) if d.as_millis() > 0 => el % d.as_millis() as u64,
                _ => el,
            },
            _ => el,
        }
    }

    fn apply_volume(&self, master: f32) {
        self.sink.set_volume((master * self.gain).clamp(0.0, 1.0));
    }
}

/// Envolve uma fonte e registra o pico de amplitude (para o VU meter da interface).
struct Metered<S: Source<Item = i16>> {
    inner: S,
    peak: Arc<AtomicU32>,
    local: u16,
    count: u32,
}

impl<S: Source<Item = i16>> Iterator for Metered<S> {
    type Item = i16;

    fn next(&mut self) -> Option<i16> {
        let sample = self.inner.next()?;
        let a = sample.unsigned_abs();
        if a > self.local {
            self.local = a;
        }
        self.count += 1;
        if self.count >= 512 {
            self.peak.fetch_max(self.local as u32, Ordering::Relaxed);
            self.local = 0;
            self.count = 0;
        }
        Some(sample)
    }
}

impl<S: Source<Item = i16>> Source for Metered<S> {
    fn current_frame_len(&self) -> Option<usize> {
        self.inner.current_frame_len()
    }
    fn channels(&self) -> u16 {
        self.inner.channels()
    }
    fn sample_rate(&self) -> u32 {
        self.inner.sample_rate()
    }
    fn total_duration(&self) -> Option<Duration> {
        self.inner.total_duration()
    }
}

fn metered<S: Source<Item = i16>>(inner: S, peak: &Arc<AtomicU32>) -> Metered<S> {
    Metered { inner, peak: Arc::clone(peak), local: 0, count: 0 }
}

/// Decodifica o arquivo em streaming (não carrega tudo na RAM) e enfileira no sink.
fn append_source(
    sink: &Sink,
    path: &Path,
    mode: &LoopMode,
    peak: &Arc<AtomicU32>,
) -> Result<Option<Duration>, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let decoder = Decoder::new(BufReader::new(file)).map_err(|e| e.to_string())?;
    let total = decoder.total_duration();
    match mode {
        LoopMode::Segment { start_ms, end_ms } if end_ms > start_ms => {
            sink.append(metered(
                decoder
                    .skip_duration(Duration::from_millis(*start_ms))
                    .take_duration(Duration::from_millis(end_ms - start_ms)),
                peak,
            ));
        }
        _ => sink.append(metered(decoder, peak)),
    }
    Ok(total)
}

struct Engine {
    handle: OutputStreamHandle,
    app: AppHandle,
    current: Option<Voice>,
    fading: Vec<Voice>,
    master: f32,
    last_progress: Instant,
}

impl Engine {
    fn emit_error(&self, msg: String) {
        let _ = self.app.emit("audio://error", msg);
    }

    fn handle(&mut self, cmd: AudioCmd) {
        match cmd {
            AudioCmd::Play { path, crossfade_ms, loop_mode, volume } => {
                self.master = volume.clamp(0.0, 1.0);
                self.play(path, crossfade_ms, loop_mode);
            }
            AudioCmd::Pause => {
                for v in self.fading.iter().chain(self.current.iter()) {
                    v.sink.pause();
                }
                if let Some(v) = self.current.as_mut() {
                    v.paused_at.get_or_insert_with(Instant::now);
                }
            }
            AudioCmd::Resume => {
                for v in self.fading.iter().chain(self.current.iter()) {
                    v.sink.play();
                }
                if let Some(v) = self.current.as_mut() {
                    if let Some(p) = v.paused_at.take() {
                        v.paused_total += p.elapsed();
                    }
                }
            }
            AudioCmd::Stop { fade_ms } => {
                if let Some(mut v) = self.current.take() {
                    if fade_ms == 0 {
                        v.sink.stop();
                    } else {
                        start_fade(&mut v, 0.0, fade_ms);
                        self.fading.push(v);
                    }
                }
            }
            AudioCmd::SetVolume(vol) => {
                self.master = vol.clamp(0.0, 1.0);
                for v in self.fading.iter().chain(self.current.iter()) {
                    v.apply_volume(self.master);
                }
            }
            AudioCmd::SetLoop(mode) => self.set_loop(mode),
        }
    }

    fn play(&mut self, path: PathBuf, crossfade_ms: u32, loop_mode: LoopMode) {
        let sink = match Sink::try_new(&self.handle) {
            Ok(s) => s,
            Err(e) => return self.emit_error(e.to_string()),
        };
        let peak = Arc::new(AtomicU32::new(0));
        let duration = match append_source(&sink, &path, &loop_mode, &peak) {
            Ok(d) => d,
            Err(e) => return self.emit_error(format!("{}: {e}", path.display())),
        };

        let mut voice = Voice {
            sink,
            path,
            loop_mode,
            duration,
            started: Instant::now(),
            paused_total: Duration::ZERO,
            paused_at: None,
            fade: None,
            gain: 1.0,
            peak,
        };

        if let Some(mut old) = self.current.take() {
            if crossfade_ms > 0 {
                start_fade(&mut old, 0.0, crossfade_ms);
                voice.gain = 0.0;
                start_fade(&mut voice, 1.0, crossfade_ms);
                self.fading.push(old);
                // Limita vozes antigas para não acumular decoders.
                while self.fading.len() > MAX_FADING {
                    self.fading.remove(0).sink.stop();
                }
            } else {
                old.sink.stop();
            }
        }
        voice.apply_volume(self.master);
        self.current = Some(voice);
    }

    fn set_loop(&mut self, mode: LoopMode) {
        let Some(v) = self.current.as_mut() else { return };
        if let LoopMode::Segment { .. } = mode {
            // Reinicia no trecho. clear() pausa o sink, então chamamos play() em seguida.
            v.sink.clear();
            v.loop_mode = mode;
            if let Err(e) = append_source(&v.sink, &v.path.clone(), &v.loop_mode, &v.peak.clone()) {
                let msg = e;
                let _ = self.app.emit("audio://error", msg);
                return;
            }
            v.started = Instant::now();
            v.paused_total = Duration::ZERO;
            if v.paused_at.is_none() {
                v.sink.play();
            }
        } else {
            v.loop_mode = mode;
        }
    }

    fn tick(&mut self) {
        let now = Instant::now();
        let master = self.master;

        // Fades (curvas de potência constante) e descarte de vozes silenciadas.
        for v in self.fading.iter_mut().chain(self.current.iter_mut()) {
            if let Some(f) = &v.fade {
                let t = (now.saturating_duration_since(f.start).as_secs_f32() / f.dur.as_secs_f32())
                    .clamp(0.0, 1.0);
                v.gain = if f.to >= f.from {
                    f.from + (f.to - f.from) * (t * FRAC_PI_2).sin()
                } else {
                    f.to + (f.from - f.to) * (t * FRAC_PI_2).cos()
                };
                v.apply_volume(master);
                if t >= 1.0 {
                    v.fade = None;
                }
            }
        }
        self.fading.retain(|v| {
            let done = v.fade.is_none() || v.sink.empty();
            if done {
                v.sink.stop();
            }
            !done
        });

        // Loop gapless: mantém sempre a próxima iteração enfileirada.
        if let Some(v) = self.current.as_mut() {
            let looping = matches!(v.loop_mode, LoopMode::Track | LoopMode::Segment { .. });
            if looping && v.sink.len() < 2 {
                let _ = append_source(&v.sink, &v.path.clone(), &v.loop_mode, &v.peak.clone());
            }
        }

        // Fim natural da faixa.
        let ended = self
            .current
            .as_ref()
            .map(|v| v.paused_at.is_none() && v.sink.empty())
            .unwrap_or(false);
        if ended {
            if let Some(v) = self.current.take() {
                let _ = self.app.emit(
                    "audio://ended",
                    EndedEvent { path: v.path.to_string_lossy().into_owned() },
                );
            }
        }

        if now.duration_since(self.last_progress) >= PROGRESS_EVERY {
            self.last_progress = now;
            if let Some(v) = &self.current {
                let _ = self.app.emit(
                    "audio://progress",
                    ProgressEvent {
                        path: v.path.to_string_lossy().into_owned(),
                        position_ms: v.position_ms(),
                        duration_ms: v.duration.map(|d| d.as_millis() as u64),
                        playing: v.paused_at.is_none(),
                        level: if v.paused_at.is_none() {
                            ((v.peak.swap(0, Ordering::Relaxed) as f32 / 32768.0) * v.gain * self.master)
                                .clamp(0.0, 1.0)
                        } else {
                            0.0
                        },
                    },
                );
            }
        }
    }
}

fn start_fade(v: &mut Voice, to: f32, ms: u32) {
    v.fade = Some(Fade {
        start: Instant::now(),
        dur: Duration::from_millis(ms.max(1) as u64),
        from: v.gain,
        to,
    });
}

fn run(app: AppHandle, rx: mpsc::Receiver<AudioCmd>) {
    let (_stream, handle) = match OutputStream::try_default() {
        Ok(s) => s,
        Err(e) => {
            let _ = app.emit("audio://error", format!("sem dispositivo de áudio: {e}"));
            return;
        }
    };
    let mut engine = Engine {
        handle,
        app,
        current: None,
        fading: Vec::new(),
        master: 1.0,
        last_progress: Instant::now(),
    };

    loop {
        match rx.recv_timeout(TICK) {
            Ok(cmd) => engine.handle(cmd),
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => break,
        }
        engine.tick();
    }
}
