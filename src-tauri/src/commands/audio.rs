use tauri::State;

use crate::domain::playback::LoopMode;
use crate::error::AppResult;
use crate::infra::audio_engine::{AudioCmd, AudioHandle};
use crate::state::AppState;

#[tauri::command]
pub fn audio_play(
    state: State<'_, AppState>,
    audio: State<'_, AudioHandle>,
    path: String,
    crossfade_ms: u32,
    loop_mode: LoopMode,
    volume: f32,
) -> AppResult<()> {
    let safe = state.ensure_registered(&path)?;
    audio.send(AudioCmd::Play {
        path: safe,
        crossfade_ms: crossfade_ms.min(15_000),
        loop_mode,
        volume,
    })
}

#[tauri::command]
pub fn audio_pause(audio: State<'_, AudioHandle>) -> AppResult<()> {
    audio.send(AudioCmd::Pause)
}

#[tauri::command]
pub fn audio_resume(audio: State<'_, AudioHandle>) -> AppResult<()> {
    audio.send(AudioCmd::Resume)
}

#[tauri::command]
pub fn audio_stop(audio: State<'_, AudioHandle>, fade_ms: u32) -> AppResult<()> {
    audio.send(AudioCmd::Stop { fade_ms: fade_ms.min(15_000) })
}

#[tauri::command]
pub fn audio_set_volume(audio: State<'_, AudioHandle>, volume: f32) -> AppResult<()> {
    audio.send(AudioCmd::SetVolume(volume))
}

#[tauri::command]
pub fn audio_set_loop(audio: State<'_, AudioHandle>, loop_mode: LoopMode) -> AppResult<()> {
    audio.send(AudioCmd::SetLoop(loop_mode))
}
