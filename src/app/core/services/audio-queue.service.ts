import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { AudioPort } from '../ports/audio.port';
import { AudioProgress, AudioState, LoopMode, RepeatMode } from '../models/audio.model';
import { MediaItem } from '../models/media.model';
import { MediaLibraryService } from './media-library.service';
import { SettingsService } from './settings.service';

const STOP_FADE_MS = 400;

/**
 * Fila de áudio. A reprodução em si acontece na thread de áudio do Rust;
 * aqui ficam a fila, o estado e as decisões (próxima faixa, crossfade, repetir fila).
 */
@Injectable({ providedIn: 'root' })
export class AudioQueueService implements OnDestroy {
  private readonly audio = inject(AudioPort);
  private readonly library = inject(MediaLibraryService);
  private readonly settings = inject(SettingsService);
  private readonly sub = new Subscription();
  private crossfadeTriggered = false;

  private readonly stateSubject = new BehaviorSubject<AudioState>({
    queue: [],
    index: -1,
    status: 'stopped',
    positionMs: 0,
    durationMs: null,
    level: 0,
    volume: this.settings.values().defaultVolume,
    repeat: 'off',
    segment: { startMs: 0, endMs: 10_000 },
    crossfadeMs: this.settings.values().defaultCrossfadeMs,
    error: null
  });

  readonly state$ = this.stateSubject.asObservable();

  constructor() {
    this.sub.add(this.audio.progress$().subscribe((p) => this.onProgress(p)));
    this.sub.add(this.audio.ended$().subscribe((e) => void this.onEnded(e.path)));
    this.sub.add(this.audio.error$().subscribe((msg) => this.patch({ error: msg, status: 'stopped', level: 0 })));
    // Metadados (duração) chegam depois do cadastro: mantém a fila atualizada.
    this.sub.add(
      this.library.items$.subscribe((items) => {
        const byId = new Map(items.map((i) => [i.id, i]));
        this.patch({ queue: this.s.queue.map((q) => byId.get(q.id) ?? q) });
      })
    );
  }

  private get s(): AudioState {
    return this.stateSubject.value;
  }

  private patch(p: Partial<AudioState>): void {
    this.stateSubject.next({ ...this.s, ...p });
  }

  private engineLoop(s: AudioState = this.s): LoopMode {
    if (s.repeat === 'track') return { mode: 'track' };
    if (s.repeat === 'segment') return { mode: 'segment', startMs: s.segment.startMs, endMs: s.segment.endMs };
    return { mode: 'off' };
  }

  private nextIndex(from: number = this.s.index): number {
    const len = this.s.queue.length;
    if (from + 1 < len) return from + 1;
    return this.s.repeat === 'queue' && len > 0 ? 0 : -1;
  }

  // ---- fila ----
  enqueue(item: MediaItem): number {
    if (item.kind !== 'audio') return -1;
    this.patch({ queue: [...this.s.queue, item] });
    return this.s.queue.length - 1;
  }

  /** Toca já: usa o item da fila se existir, senão acrescenta ao fim. */
  async playNow(item: MediaItem): Promise<void> {
    let i = this.s.queue.findIndex((q) => q.id === item.id);
    if (i < 0) i = this.enqueue(item);
    if (i >= 0) await this.playAt(i, this.s.status === 'playing' ? this.s.crossfadeMs : 0);
  }

  async removeAt(i: number): Promise<void> {
    const { queue, index } = this.s;
    if (i < 0 || i >= queue.length) return;
    if (i === index && this.s.status !== 'stopped') await this.stop();
    this.patch({ queue: queue.filter((_, k) => k !== i), index: i < index ? index - 1 : i === index ? -1 : index });
  }

  move(i: number, delta: -1 | 1): void {
    const q = [...this.s.queue];
    const j = i + delta;
    if (j < 0 || j >= q.length) return;
    [q[i], q[j]] = [q[j], q[i]];
    let index = this.s.index;
    if (index === i) index = j;
    else if (index === j) index = i;
    this.patch({ queue: q, index });
  }

  async clear(): Promise<void> {
    await this.stop();
    this.patch({ queue: [], index: -1 });
  }

  // ---- transporte ----
  async playAt(i: number, crossfadeMs = 0): Promise<void> {
    const item = this.s.queue[i];
    if (!item) return;
    this.crossfadeTriggered = false;
    this.patch({ index: i, status: 'playing', positionMs: 0, durationMs: item.durationMs ?? null, error: null });
    try {
      await this.audio.play(item.path, crossfadeMs, this.engineLoop(), this.s.volume);
    } catch (e) {
      this.patch({ status: 'stopped', error: String(e) });
    }
  }

  async next(): Promise<void> {
    const i = this.nextIndex();
    if (i >= 0) await this.playAt(i, this.s.status === 'playing' ? this.s.crossfadeMs : 0);
  }

  async prev(): Promise<void> {
    // Mais de 3 s tocados: volta ao início da faixa; senão, vai para a anterior.
    const target = this.s.positionMs > 3000 || this.s.index <= 0 ? Math.max(0, this.s.index) : this.s.index - 1;
    if (this.s.queue[target]) await this.playAt(target, 0);
  }

  async togglePause(): Promise<void> {
    if (this.s.status === 'playing') {
      await this.audio.pause();
      this.patch({ status: 'paused', level: 0 });
    } else if (this.s.status === 'paused') {
      await this.audio.resume();
      this.patch({ status: 'playing' });
    } else if (this.s.queue.length) {
      await this.playAt(this.s.index >= 0 ? this.s.index : 0);
    }
  }

  async stop(): Promise<void> {
    await this.audio.stop(STOP_FADE_MS).catch(() => undefined);
    this.patch({ status: 'stopped', positionMs: 0, level: 0 });
  }

  // ---- ajustes ----
  async setVolume(volume: number): Promise<void> {
    const v = Math.min(1, Math.max(0, volume));
    this.patch({ volume: v });
    await this.audio.setVolume(v).catch(() => undefined);
  }

  async setRepeat(repeat: RepeatMode): Promise<void> {
    this.patch({ repeat, error: null });
    if (this.s.status !== 'stopped') await this.audio.setLoop(this.engineLoop()).catch(() => undefined);
  }

  async setSegment(startMs: number, endMs: number): Promise<void> {
    if (endMs <= startMs) {
      this.patch({ error: 'O fim do trecho precisa ser maior que o início.' });
      return;
    }
    this.patch({ segment: { startMs, endMs }, error: null });
    if (this.s.repeat === 'segment' && this.s.status !== 'stopped') {
      await this.audio.setLoop(this.engineLoop()).catch(() => undefined);
    }
  }

  setCrossfadeMs(ms: number): void {
    this.patch({ crossfadeMs: Math.min(8000, Math.max(0, ms)) });
  }

  // ---- eventos do motor ----
  private onProgress(p: AudioProgress): void {
    const cur = this.s.queue[this.s.index];
    if (!cur || cur.path !== p.path) return;
    this.patch({
      positionMs: p.positionMs,
      durationMs: p.durationMs ?? cur.durationMs ?? null,
      status: p.playing ? 'playing' : 'paused',
      level: p.level
    });

    // Crossfade automático: inicia a próxima faixa antes de a atual acabar.
    const s = this.s;
    const next = this.nextIndex();
    if (
      (s.repeat === 'off' || s.repeat === 'queue') && p.playing && next >= 0 && s.crossfadeMs > 0 &&
      s.durationMs != null && !this.crossfadeTriggered && s.durationMs - p.positionMs <= s.crossfadeMs
    ) {
      this.crossfadeTriggered = true;
      void this.playAt(next, s.crossfadeMs);
    }
  }

  private async onEnded(path: string): Promise<void> {
    const cur = this.s.queue[this.s.index];
    if (!cur || cur.path !== path) return;
    const next = this.nextIndex();
    if (next >= 0) await this.playAt(next, 0);
    else this.patch({ status: 'stopped', positionMs: 0, level: 0 });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
