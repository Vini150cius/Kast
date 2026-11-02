import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Subscription, interval } from 'rxjs';
import { DisplayPort } from '../ports/display.port';
import { DisplayCommand, TransitionStyle, VideoQueueItem, VideoState } from '../models/display.model';
import { MediaItem } from '../models/media.model';
import { MediaLibraryService } from './media-library.service';
import { SettingsService } from './settings.service';

const IMAGE_TICK_MS = 250;

/**
 * Fila de vídeo/imagem dos exibidores. O controlador decide a sequência;
 * os exibidores só renderizam o comando recebido e avisam quando o vídeo termina.
 * Fallback: acabou a fila (ou o operador parou) -> mostra a imagem de fundo.
 */
@Injectable({ providedIn: 'root' })
export class VideoQueueService implements OnDestroy {
  private readonly display = inject(DisplayPort);
  private readonly library = inject(MediaLibraryService);
  private readonly settings = inject(SettingsService);
  private readonly sub = new Subscription();
  private imageTimer: Subscription | null = null;
  private lastShow: DisplayCommand | null = null;

  private readonly stateSubject = new BehaviorSubject<VideoState>({
    queue: [],
    index: -1,
    status: 'idle',
    playId: 0,
    transitionMs: this.settings.values().defaultTransitionMs,
    transitionStyle: 'fade',
    fallback: null,
    autoAdvance: true,
    frozen: false,
    blackout: false,
    positionMs: 0,
    durationMs: null,
    error: null
  });

  readonly state$ = this.stateSubject.asObservable();

  constructor() {
    this.sub.add(this.display.ended$().subscribe((e) => this.onItemFinished(e.playId)));
    this.sub.add(
      this.display.progress$().subscribe((p) => {
        const cur = this.s.queue[this.s.index];
        if (p.playId !== this.s.playId || this.s.status !== 'playing' || cur?.media.kind !== 'video') return;
        this.patch({ positionMs: p.positionMs, durationMs: p.durationMs ?? this.s.durationMs });
      })
    );
    // Exibidor aberto no meio do evento: reenvia a cena atual e os estados ativos.
    this.sub.add(
      this.display.ready$().subscribe(() => {
        if (this.lastShow) void this.send(this.lastShow);
        if (this.s.frozen) void this.send({ type: 'freeze', frozen: true });
        if (this.s.blackout) void this.send({ type: 'blackout', on: true, transitionMs: 0 });
      })
    );
    // Metadados (duração) chegam depois do cadastro: mantém a fila atualizada.
    this.sub.add(
      this.library.items$.subscribe((items) => {
        const byId = new Map(items.map((i) => [i.id, i]));
        this.patch({
          queue: this.s.queue.map((q) => ({ ...q, media: byId.get(q.media.id) ?? q.media })),
          fallback: this.s.fallback ? (byId.get(this.s.fallback.id) ?? this.s.fallback) : null
        });
      })
    );
  }

  private get s(): VideoState {
    return this.stateSubject.value;
  }

  private patch(p: Partial<VideoState>): void {
    this.stateSubject.next({ ...this.s, ...p });
  }

  /** Índice que o botão EXIBIR vai tocar. */
  cursor(s: VideoState = this.s): number {
    if (!s.queue.length) return -1;
    if (s.status === 'playing') return s.index;
    return s.index + 1 < s.queue.length ? s.index + 1 : 0;
  }

  // ---- fila ----
  enqueue(media: MediaItem): number {
    if (media.kind === 'audio') return -1;
    const item: VideoQueueItem = { media, loop: false, durationMs: this.settings.values().defaultImageSec * 1000 };
    this.patch({ queue: [...this.s.queue, item] });
    return this.s.queue.length - 1;
  }

  /** Exibe já: usa o item da fila se existir, senão acrescenta ao fim. */
  async showNow(media: MediaItem): Promise<void> {
    let i = this.s.queue.findIndex((q) => q.media.id === media.id);
    if (i < 0) i = this.enqueue(media);
    if (i >= 0) await this.playAt(i);
  }

  removeAt(i: number): void {
    const { queue, index } = this.s;
    if (i < 0 || i >= queue.length) return;
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

  updateItem(i: number, changes: Partial<Pick<VideoQueueItem, 'loop' | 'durationMs'>>): void {
    this.patch({ queue: this.s.queue.map((it, k) => (k === i ? { ...it, ...changes } : it)) });
  }

  clearQueue(): void {
    this.patch({ queue: [], index: -1 });
  }

  // ---- ajustes ----
  setTransitionMs(ms: number): void {
    this.patch({ transitionMs: Math.min(3000, Math.max(0, ms)) });
  }

  setTransitionStyle(style: TransitionStyle): void {
    this.patch({ transitionStyle: style });
  }

  setAutoAdvance(v: boolean): void {
    this.patch({ autoAdvance: v });
  }

  async setFallback(media: MediaItem | null): Promise<void> {
    if (media && media.kind !== 'image') return;
    this.patch({ fallback: media });
    if (this.s.status === 'fallback' || (this.s.status === 'idle' && media && !this.s.blackout)) await this.showFallback();
  }

  // ---- transporte ----
  /** EXIBIR: toca o item selecionado (ou o próximo da fila). */
  async play(): Promise<void> {
    const i = this.cursor();
    if (i >= 0) await this.playAt(i);
  }

  async playAt(i: number): Promise<void> {
    const item = this.s.queue[i];
    if (!item || item.media.kind === 'audio') return;
    this.cancelTimer();
    const playId = this.s.playId + 1;
    const isImage = item.media.kind === 'image';
    this.patch({
      index: i,
      status: 'playing',
      playId,
      error: null,
      positionMs: 0,
      durationMs: isImage ? (item.durationMs > 0 ? item.durationMs : null) : (item.media.durationMs ?? null)
    });
    await this.dispatchShow({
      type: 'show',
      playId,
      path: item.media.path,
      kind: item.media.kind as 'video' | 'image',
      loopPlayback: !isImage && item.loop,
      transitionMs: this.s.transitionMs,
      style: this.s.transitionStyle
    });
    // Imagens avançam por tempo; duração 0 = fica na tela até o operador mudar.
    if (isImage && item.durationMs > 0) this.startImageTimer(playId, item.durationMs);
  }

  async next(): Promise<void> {
    const i = this.s.index + 1;
    if (i < this.s.queue.length) await this.playAt(i);
    else await this.showFallback();
  }

  async prev(): Promise<void> {
    if (this.s.queue.length) await this.playAt(Math.max(0, this.s.index - 1));
  }

  /** Parar: volta para a cena de fallback (ou tela preta, se não houver). */
  async stop(): Promise<void> {
    this.cancelTimer();
    await this.showFallback();
  }

  /** Tela preta mestre (F8): cobre a saída sem interromper a mídia por baixo. */
  async toggleBlackout(): Promise<void> {
    const on = !this.s.blackout;
    this.patch({ blackout: on });
    await this.send({ type: 'blackout', on, transitionMs: Math.min(this.s.transitionMs, 400) });
  }

  /** Congelar: pausa o vídeo no frame atual e segura o avanço automático. */
  async toggleFreeze(): Promise<void> {
    const frozen = !this.s.frozen;
    this.patch({ frozen });
    await this.send({ type: 'freeze', frozen });
  }

  async seek(ratio: number): Promise<void> {
    const cur = this.s.queue[this.s.index];
    const dur = this.s.durationMs;
    if (this.s.status !== 'playing' || cur?.media.kind !== 'video' || !dur) return;
    const positionMs = Math.round(Math.min(1, Math.max(0, ratio)) * dur);
    this.patch({ positionMs });
    await this.send({ type: 'seek', positionMs });
  }

  private async showFallback(): Promise<void> {
    this.cancelTimer();
    const playId = this.s.playId + 1;
    const fb = this.s.fallback;
    if (!fb) {
      this.lastShow = null;
      this.patch({ status: 'idle', playId, positionMs: 0, durationMs: null });
      await this.send({ type: 'clear', transitionMs: this.s.transitionMs });
      return;
    }
    this.patch({ status: 'fallback', playId, positionMs: 0, durationMs: null });
    await this.dispatchShow({
      type: 'show',
      playId,
      path: fb.path,
      kind: 'image',
      loopPlayback: false,
      transitionMs: this.s.transitionMs,
      style: this.s.transitionStyle
    });
  }

  private startImageTimer(playId: number, durationMs: number): void {
    this.imageTimer = interval(IMAGE_TICK_MS).subscribe(() => {
      if (this.s.playId !== playId) return;
      if (this.s.frozen || this.s.blackout) return; // relógio da imagem pausa junto
      const pos = Math.min(durationMs, this.s.positionMs + IMAGE_TICK_MS);
      this.patch({ positionMs: pos });
      if (pos >= durationMs) this.onItemFinished(playId);
    });
  }

  /** Vários exibidores avisam o mesmo fim; só o primeiro (playId atual) conta. */
  private onItemFinished(playId: number): void {
    if (this.s.playId !== playId || this.s.status !== 'playing' || this.s.frozen) return;
    if (this.s.autoAdvance && this.s.index + 1 < this.s.queue.length) void this.playAt(this.s.index + 1);
    else void this.showFallback();
  }

  private cancelTimer(): void {
    this.imageTimer?.unsubscribe();
    this.imageTimer = null;
  }

  private async dispatchShow(cmd: DisplayCommand): Promise<void> {
    this.lastShow = cmd;
    await this.send(cmd);
  }

  private async send(cmd: DisplayCommand): Promise<void> {
    try {
      await this.display.send(cmd);
    } catch (e) {
      this.patch({ error: String(e) });
    }
  }

  ngOnDestroy(): void {
    this.cancelTimer();
    this.sub.unsubscribe();
  }
}
