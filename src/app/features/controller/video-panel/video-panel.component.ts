import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IconComponent } from '../../../shared/icon.component';
import { MsToTimePipe } from '../../../shared/pipes/ms-to-time.pipe';
import { VideoQueueService } from '../../../core/services/video-queue.service';
import { MediaLibraryService } from '../../../core/services/media-library.service';
import { MonitorService } from '../../../core/services/monitor.service';
import { SafeModeService } from '../../../core/services/safe-mode.service';
import { TransitionStyle } from '../../../core/models/display.model';

@Component({
  selector: 'app-video-panel',
  standalone: true,
  imports: [IconComponent, MsToTimePipe],
  template: `
    <section class="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-app-border bg-app-surface shadow-sm" aria-label="Vídeo e imagem">
      <!-- Cabeçalho e estado -->
      <div class="flex items-center justify-between border-b border-app-border p-3">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <app-icon name="monitor" [size]="15" class="text-amber-400" />
            <h2 class="text-sm font-bold tracking-wide text-slate-100">Vídeo &amp; Imagem</h2>
          </div>
          <span class="inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-bold" [class]="pill().cls" role="status">
            <span class="mr-1.5 h-2 w-2 rounded-full" [class]="pill().dot"></span>{{ pill().text }}
          </span>
        </div>
        <button class="flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition disabled:opacity-40"
          [class]="fullscreen() ? 'border-amber-500/60 bg-amber-500/10 text-amber-300' : 'border-app-border bg-app-card text-slate-300 hover:bg-app-cardHover hover:text-slate-100'"
          [disabled]="!displays().length" [attr.aria-pressed]="fullscreen()" (click)="monitors.toggleFullscreen()" title="Tela cheia nas janelas de exibição">
          <app-icon name="expand" [size]="11" /><span>Tela Cheia</span>
        </button>
      </div>

      <!-- Controles -->
      <div class="border-b border-app-border bg-app-card/60 p-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface p-1">
            <button class="flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-app-card hover:text-slate-100 disabled:opacity-40" [disabled]="!s().queue.length" (click)="video.prev()" title="Item anterior">
              <app-icon name="skip-back" [size]="12" /><span class="hidden sm:inline">Anterior</span>
            </button>
            <button class="flex items-center gap-1.5 rounded bg-amber-500 px-5 py-1.5 text-xs font-black text-slate-950 shadow-glow-accent transition hover:bg-amber-400 disabled:opacity-40" [disabled]="!s().queue.length" (click)="video.play()" title="Exibir item selecionado no telão">
              <app-icon name="play" [size]="12" /><span>EXIBIR</span>
            </button>
            <button class="flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-app-card hover:text-slate-100 disabled:opacity-40" [disabled]="!s().queue.length" (click)="video.next()" title="Próximo item">
              <span class="hidden sm:inline">Próximo</span><app-icon name="skip-forward" [size]="12" />
            </button>
            <div class="mx-1 h-5 w-px bg-app-border"></div>
            <button class="flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-rose-950/40 hover:text-rose-400 disabled:opacity-40" [disabled]="s().status === 'idle' && !s().fallback" (click)="video.stop()" title="Parar: volta para a cena de fundo">
              <app-icon name="stop" [size]="11" /><span>Parar</span>
            </button>
            <button class="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-bold transition"
              [class]="s().blackout ? 'border-rose-500 bg-rose-700 text-white' : 'border-rose-900/40 bg-slate-900 text-rose-400 hover:bg-black'"
              [attr.aria-pressed]="s().blackout" (click)="video.toggleBlackout()" title="Corta a imagem para preto (F8)">
              <app-icon name="dot" [size]="8" class="text-rose-500" /><span>Tela Preta</span>
            </button>
          </div>

          <div class="flex items-center gap-2">
            <label for="tr" class="whitespace-nowrap text-xs font-medium text-slate-400">Transição:</label>
            <input id="tr" type="range" min="0" max="3" step="0.1" class="w-24" [value]="s().transitionMs / 1000" [disabled]="s().transitionStyle === 'cut'"
              (input)="video.setTransitionMs(+$any($event.target).value * 1000)" />
            <span class="w-8 font-mono text-xs font-bold text-amber-400">{{ (s().transitionMs / 1000).toFixed(1) }}s</span>
            <select class="rounded border border-app-border bg-app-card px-2 py-1 text-[11px] text-slate-300 focus:border-amber-500" aria-label="Estilo de transição"
              [value]="s().transitionStyle" (change)="video.setTransitionStyle($any($event.target).value)">
              <option value="fade">Fade suave</option>
              <option value="cut">Corte seco</option>
              <option value="dissolve">Cross-dissolve</option>
            </select>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-app-border/70 pt-3 text-xs">
          <label class="flex cursor-pointer items-center gap-2 text-slate-300 hover:text-slate-100">
            <input type="checkbox" class="h-4 w-4 rounded border-app-border bg-app-surface accent-amber-500" [checked]="s().autoAdvance" (change)="video.setAutoAdvance($any($event.target).checked)" />
            <span class="font-medium">Passar para o próximo item ao terminar</span>
          </label>

          <div class="relative flex items-center gap-2">
            <span class="text-slate-400">Cena de fundo (fallback):</span>
            <button class="flex max-w-[220px] items-center gap-1.5 rounded border border-app-border bg-app-surface px-2 py-1 font-mono text-[11px] text-slate-300 transition hover:border-amber-500/50 disabled:opacity-60"
              [disabled]="safe.enabled()" (click)="fbOpen.set(!fbOpen())" [attr.aria-expanded]="fbOpen()" title="Escolher a imagem de fundo">
              <app-icon name="image" [size]="12" class="shrink-0 text-amber-400" />
              <span class="truncate text-slate-200">{{ s().fallback?.name ?? 'Nenhuma' }}</span>
              <app-icon name="swap" [size]="11" class="shrink-0 text-slate-400" />
            </button>
            @if (fbOpen()) {
              <div class="absolute right-0 top-full z-20 mt-1 max-h-56 w-72 overflow-y-auto rounded-lg border border-app-borderLight bg-app-card p-1 shadow-xl" role="listbox" aria-label="Imagens disponíveis">
                @for (img of images(); track img.id) {
                  <button role="option" [attr.aria-selected]="s().fallback?.id === img.id" class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-app-cardHover"
                    [class]="s().fallback?.id === img.id ? 'text-amber-400' : 'text-slate-200'" (click)="pickFallback(img.id)">
                    <app-icon name="image" [size]="12" class="text-sky-400" /><span class="truncate">{{ img.name }}</span>
                  </button>
                } @empty {
                  <p class="px-2 py-3 text-center text-[11px] text-slate-500">Nenhuma imagem na biblioteca.</p>
                }
                @if (s().fallback) {
                  <button class="mt-1 w-full rounded border-t border-app-border px-2 py-1.5 text-left text-xs text-slate-400 hover:text-red-400" (click)="pickFallback(null)">Remover cena de fundo</button>
                }
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Reproduzindo agora -->
      <div class="flex flex-col gap-2 border-b border-app-border bg-app-base p-3">
        <div class="flex items-center justify-between text-xs">
          <span class="flex min-w-0 items-center gap-1.5 font-bold text-slate-300">
            <app-icon name="circle-play" [size]="14" [class]="s().status === 'playing' ? 'text-emerald-400' : 'text-slate-600'" />
            <span class="truncate">{{ nowLabel() }} <span class="font-normal text-slate-100">{{ nowName() }}</span></span>
          </span>
          <span class="shrink-0 pl-3 font-mono text-xs font-semibold text-amber-400">
            {{ s().positionMs | msToTime }} <span class="text-slate-500">/ {{ s().durationMs | msToTime }}</span>
            <span class="ml-1 text-slate-400">({{ remaining() }})</span>
          </span>
        </div>
        <div>
          <div class="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-800" [class.cursor-pointer]="canSeek()" role="slider" aria-label="Posição do vídeo"
            [attr.aria-valuenow]="progress()" aria-valuemin="0" aria-valuemax="100" (click)="onSeek($event)">
            <div class="relative h-full rounded-full bg-amber-500" [style.width.%]="progress()">
              <span class="absolute bottom-0 right-0 top-0 w-2 rounded-full bg-amber-200"></span>
            </div>
          </div>
          <div class="mt-1 flex justify-between font-mono text-[10px] text-slate-500">
            <span>00:00</span><span>{{ s().durationMs | msToTime }}</span>
          </div>
        </div>
        @if (s().error) { <p class="text-xs text-red-400" role="alert">{{ s().error }}</p> }
      </div>

      <!-- Fila de projeção -->
      <div class="flex min-h-0 flex-1 flex-col p-3">
        <div class="mb-2 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold tracking-wider text-slate-400">Fila de projeção</span>
            <span class="rounded border border-app-border bg-app-card px-2 py-0.5 font-mono text-[10px] text-slate-300">{{ waiting() }} {{ waiting() === 1 ? 'item em espera' : 'itens em espera' }}</span>
          </div>
          <button class="flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-rose-400 disabled:opacity-40 disabled:hover:text-slate-400" [disabled]="!s().queue.length || safe.enabled()" (click)="video.clearQueue()">
            <app-icon name="trash" [size]="11" /><span>Limpar fila</span>
          </button>
        </div>

        <div class="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          @for (it of s().queue; track $index) {
            <div class="group rounded-lg border bg-app-card p-2.5 transition hover:border-app-borderLight"
              [class]="isLive($index) ? 'border-amber-500/50 bg-app-cardHover' : 'border-app-border'">
              <div class="flex items-center justify-between">
                <div class="flex min-w-0 items-center gap-3">
                  <span class="w-5 font-mono text-xs font-bold text-slate-500">#{{ $index + 1 }}</span>
                  <div class="flex h-7 w-9 shrink-0 items-center justify-center rounded border border-app-border bg-slate-900" [class]="it.media.kind === 'image' ? 'text-sky-400' : 'text-amber-400'">
                    <app-icon [name]="it.media.kind === 'image' ? 'image' : 'play'" [size]="12" />
                  </div>
                  <div class="min-w-0">
                    <div class="truncate text-xs font-semibold text-slate-200 group-hover:text-amber-400" [title]="it.media.path">{{ it.media.name }}</div>
                    <div class="flex items-center gap-2 font-mono text-[10px] text-slate-400">
                      @if (it.media.kind === 'video') { <span>Duração: {{ it.media.durationMs | msToTime }}</span> }
                      @else { <span>{{ it.durationMs > 0 ? 'Estático: ' + (it.durationMs / 1000) + 's' : 'Estático: fixo' }}</span> }
                      <span>•</span>
                      <span class="font-sans" [class]="isLive($index) ? 'font-semibold text-emerald-400' : $index === upNext() ? 'font-semibold text-amber-400' : ''">{{ status($index) }}</span>
                    </div>
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-0.5">
                  <button class="rounded p-1.5 text-xs text-slate-400 hover:bg-app-cardHover hover:text-amber-400 disabled:opacity-30" [disabled]="$index === 0 || safe.enabled()" (click)="video.move($index, -1)" aria-label="Subir"><app-icon name="chevron-up" [size]="12" /></button>
                  <button class="rounded p-1.5 text-xs text-slate-400 hover:bg-app-cardHover hover:text-amber-400 disabled:opacity-30" [disabled]="$index === s().queue.length - 1 || safe.enabled()" (click)="video.move($index, 1)" aria-label="Descer"><app-icon name="chevron-down" [size]="12" /></button>
                  <button class="rounded p-1.5 text-xs text-slate-400 hover:bg-app-cardHover hover:text-amber-400 disabled:opacity-30" [disabled]="safe.enabled()" (click)="video.playAt($index)" title="Exibir imediatamente" aria-label="Exibir imediatamente"><app-icon name="forward" [size]="12" /></button>
                  <button class="rounded p-1.5 text-xs text-slate-400 hover:bg-app-cardHover hover:text-rose-400 disabled:opacity-30" [disabled]="safe.enabled()" (click)="video.removeAt($index)" title="Remover da fila" aria-label="Remover da fila"><app-icon name="x" [size]="12" /></button>
                </div>
              </div>
              <div class="mt-1.5 pl-8 text-[11px] text-slate-400">
                @if (it.media.kind === 'video') {
                  <label class="inline-flex cursor-pointer items-center gap-2 hover:text-slate-200">
                    <input type="checkbox" class="h-3.5 w-3.5 accent-amber-500" [checked]="it.loop" (change)="video.updateItem($index, { loop: $any($event.target).checked })" />
                    Repetir até avançar
                  </label>
                } @else {
                  <label class="inline-flex items-center gap-2">
                    Tempo na tela (s, 0 = fixa)
                    <input type="number" min="0" max="3600" class="w-16 rounded border border-app-border bg-app-surface px-1.5 py-0.5 text-slate-100"
                      [value]="it.durationMs / 1000" (change)="video.updateItem($index, { durationMs: Math.max(0, +$any($event.target).value) * 1000 })" />
                  </label>
                }
              </div>
            </div>
          } @empty {
            <p class="px-3 py-8 text-center text-xs text-slate-500">A fila está vazia. Use o botão + na biblioteca para enviar vídeos ou imagens.</p>
          }
        </div>
      </div>
    </section>
  `
})
export class VideoPanelComponent {
  protected readonly video = inject(VideoQueueService);
  protected readonly monitors = inject(MonitorService);
  protected readonly safe = inject(SafeModeService);
  private readonly library = inject(MediaLibraryService);
  protected readonly Math = Math;

  protected readonly s = toSignal(this.video.state$, { requireSync: true });
  protected readonly displays = toSignal(this.monitors.displays$, { requireSync: true });
  protected readonly fullscreen = toSignal(this.monitors.fullscreen$, { requireSync: true });
  private readonly libItems = toSignal(this.library.items$, { requireSync: true });

  protected readonly fbOpen = signal(false);
  protected readonly images = computed(() => this.libItems().filter((i) => i.kind === 'image' && !i.missing));

  protected readonly displayName = computed(() => {
    const d = this.displays();
    if (!d.length) return '';
    if (d.length > 1) return `${d.length} monitores`;
    if (d[0] === 'display-preview') return 'Pré-visualização';
    return `Monitor ${Number(d[0].replace('display-', '')) + 1}`;
  });

  protected readonly pill = computed(() => {
    const s = this.s();
    if (!this.displays().length) return { text: 'SEM EXIBIDOR', cls: 'border-app-border bg-app-card text-slate-400', dot: 'bg-slate-500' };
    if (s.blackout) return { text: 'TELA PRETA', cls: 'border-red-700/70 bg-red-950 text-red-300', dot: 'bg-red-500' };
    if (s.frozen) return { text: 'CONGELADO', cls: 'border-sky-700/70 bg-sky-950 text-sky-300', dot: 'bg-sky-400' };
    if (s.status === 'playing') return { text: `NO AR • ${this.displayName()}`, cls: 'border-emerald-700/60 bg-emerald-950 text-emerald-300 shadow-glow-live', dot: 'bg-emerald-400 animate-pulse' };
    if (s.status === 'fallback') return { text: 'CENA DE FUNDO', cls: 'border-amber-700/60 bg-amber-950/60 text-amber-300', dot: 'bg-amber-400' };
    return { text: 'EM ESPERA', cls: 'border-app-border bg-app-card text-slate-300', dot: 'bg-slate-400' };
  });

  protected readonly nowName = computed(() => {
    const s = this.s();
    if (s.status === 'playing') return s.queue[s.index]?.media.name ?? '';
    if (s.status === 'fallback') return s.fallback?.name ?? '';
    return 'nada no ar';
  });
  protected readonly nowLabel = computed(() => (this.s().status === 'fallback' ? 'Cena de fundo:' : 'Reproduzindo agora:'));

  protected readonly progress = computed(() => {
    const s = this.s();
    return s.durationMs ? Math.min(100, (s.positionMs / s.durationMs) * 100) : 0;
  });

  protected readonly remaining = computed(() => {
    const s = this.s();
    if (!s.durationMs) return '--:--';
    const left = Math.max(0, Math.floor((s.durationMs - s.positionMs) / 1000));
    return `-${Math.floor(left / 60).toString().padStart(2, '0')}:${(left % 60).toString().padStart(2, '0')}`;
  });

  protected readonly canSeek = computed(() => {
    const s = this.s();
    return s.status === 'playing' && s.queue[s.index]?.media.kind === 'video' && !!s.durationMs;
  });

  protected readonly upNext = computed(() => this.video.cursor(this.s()) === this.s().index && this.s().status === 'playing' ? this.s().index + 1 : this.video.cursor(this.s()));
  protected readonly waiting = computed(() => {
    const s = this.s();
    return s.queue.filter((_, i) => i > s.index || (s.status !== 'playing' && i >= s.index && s.index < 0)).length;
  });

  protected isLive(i: number): boolean {
    return this.s().status === 'playing' && this.s().index === i;
  }

  protected status(i: number): string {
    if (this.isLive(i)) return 'No ar';
    if (i === this.upNext()) return 'A seguir';
    return i <= this.s().index ? 'Exibido' : 'Em espera';
  }

  protected pickFallback(id: string | null): void {
    this.fbOpen.set(false);
    void this.video.setFallback(id ? (this.images().find((i) => i.id === id) ?? null) : null);
  }

  protected onSeek(e: MouseEvent): void {
    if (!this.canSeek()) return;
    const bar = e.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    void this.video.seek((e.clientX - rect.left) / rect.width);
  }

  protected setTransitionStyle(v: TransitionStyle): void {
    this.video.setTransitionStyle(v);
  }
}
