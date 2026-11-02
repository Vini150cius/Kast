import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IconComponent } from '../../../shared/icon.component';
import { MonitorService } from '../../../core/services/monitor.service';
import { VideoQueueService } from '../../../core/services/video-queue.service';
import { AudioQueueService } from '../../../core/services/audio-queue.service';
import { SafeModeService } from '../../../core/services/safe-mode.service';
import { CountdownService } from '../../../core/services/countdown.service';
import { SettingsService } from '../../../core/services/settings.service';
import { formatClock } from '../../../shared/utils/format';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [IconComponent],
  template: `
    <header class="relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-app-border bg-app-surface px-4 shadow-md">
      <!-- Marca e status -->
      <div class="flex items-center gap-3">
        <img src="assets/kast-emblem.png" alt="Kast" class="h-10 w-10 select-none" style="mix-blend-mode: screen; -webkit-mask-image: radial-gradient(circle, #000 58%, transparent 100%); mask-image: radial-gradient(circle, #000 58%, transparent 100%)" draggable="false" />
        <div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold tracking-wide text-slate-100">KAST</span>
            <span class="rounded border border-app-border bg-app-card px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-400">v1.0.0</span>
          </div>
          <div class="flex items-center gap-2 text-[11px] text-slate-400">
            @if (connected()) {
              <span class="inline-flex items-center font-medium text-emerald-400">
                <span class="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"></span>Tauri IPC: Conectado
              </span>
            } @else {
              <span class="inline-flex items-center font-medium text-red-400">
                <span class="mr-1.5 h-1.5 w-1.5 rounded-full bg-red-400"></span>Tauri IPC: Sem resposta
              </span>
            }
            <span>•</span>
            <span class="font-mono" [class.text-red-400]="!!audioError()">{{ audioError() ? 'Áudio: erro' : 'Áudio: pronto' }}</span>
            <span>•</span>
            <span class="font-mono">Exibidores: {{ displays().length }}</span>
          </div>
        </div>
      </div>

      <!-- Relógio e contador -->
      <div class="relative hidden items-center md:flex">
        <div class="flex items-center gap-3 rounded-md border border-app-border bg-app-card px-3.5 py-1 shadow-inner">
          <div class="text-right">
            <span class="block text-[9px] font-semibold uppercase tracking-wider text-slate-400">Hora do show</span>
            <span class="font-mono text-base font-bold leading-none text-amber-400">{{ clock() }}</span>
          </div>
          <div class="h-6 w-px bg-app-border"></div>
          <button class="rounded text-left" (click)="cdOpen.set(!cdOpen())" [attr.aria-expanded]="cdOpen()" title="Configurar contador regressivo">
            <span class="block text-[9px] font-semibold uppercase tracking-wider text-slate-400">Contador regressivo</span>
            <span class="font-mono text-sm font-semibold leading-none"
              [class]="countdown.running() ? 'text-emerald-400' : countdown.finished() ? 'text-red-400 animate-pulse' : 'text-slate-300'">{{ cdText() }}</span>
          </button>
        </div>

        @if (cdOpen()) {
          <div class="absolute left-1/2 top-full z-40 mt-2 w-72 -translate-x-1/2 rounded-lg border border-app-borderLight bg-app-card p-3 shadow-xl" role="dialog" aria-label="Contador regressivo">
            <p class="mb-2 text-xs font-semibold text-slate-200">Contador regressivo</p>
            <div class="flex flex-wrap gap-1.5">
              @for (m of presets; track m) {
                <button class="rounded border border-app-border bg-app-surface px-2 py-1 text-xs text-slate-300 hover:border-amber-500/60 hover:text-amber-400" (click)="countdown.setMinutes(m)">{{ m }} min</button>
              }
            </div>
            <div class="mt-3 flex items-center gap-2 text-xs text-slate-300">
              <label for="cd-min">Minutos</label>
              <input id="cd-min" #mins type="number" min="0" max="999" step="1" class="w-20 rounded border border-app-border bg-app-surface px-2 py-1 text-slate-100" [value]="15" />
              <button class="rounded bg-app-surface px-2 py-1 hover:bg-app-cardHover" (click)="countdown.setMinutes(+mins.value)">Definir</button>
            </div>
            <div class="mt-3 flex gap-2">
              @if (countdown.running()) {
                <button class="flex-1 rounded bg-app-surface px-2 py-1.5 text-xs font-semibold text-slate-200 hover:bg-app-cardHover" (click)="countdown.pause()">Pausar</button>
              } @else {
                <button class="flex-1 rounded bg-amber-500 px-2 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-40" [disabled]="countdown.remainingSec() === 0" (click)="countdown.start()">Iniciar</button>
              }
              <button class="flex-1 rounded bg-app-surface px-2 py-1.5 text-xs font-semibold text-slate-300 hover:bg-app-cardHover" (click)="countdown.reset()">Zerar</button>
            </div>
          </div>
        }
      </div>

      <!-- Controles de emergência -->
      <div class="flex items-center gap-2">
        <button class="flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium transition"
          [class]="video().frozen ? 'border-sky-500/70 bg-sky-950/60 text-sky-200' : 'border-app-border bg-app-card text-slate-300 hover:bg-app-cardHover hover:text-slate-100'"
          [attr.aria-pressed]="video().frozen" (click)="videoSvc.toggleFreeze()"
          title="Congela a projeção mantendo o frame atual na tela">
          <app-icon name="snowflake" [size]="13" class="text-sky-400" />
          <span>{{ video().frozen ? 'Congelado' : 'Congelar' }}</span>
        </button>

        <button class="flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium transition"
          [class]="safe.enabled() ? 'border-amber-500/70 bg-amber-950/50 text-amber-200' : 'border-app-border bg-app-card text-slate-300 hover:bg-app-cardHover hover:text-slate-100'"
          [attr.aria-pressed]="safe.enabled()" (click)="safe.toggle()"
          title="Modo Seguro: impede exclusões, reordenação e trocas diretas acidentais">
          <app-icon name="shield" [size]="13" class="text-amber-400" />
          <span class="hidden sm:inline">{{ safe.enabled() ? 'Seguro ativo' : 'Modo Seguro' }}</span>
        </button>

        <button class="flex items-center gap-2 rounded border px-3.5 py-1.5 text-xs font-bold transition focus-visible:ring-2 focus-visible:ring-red-500"
          [class]="video().blackout ? 'border-red-500 bg-red-700 text-white shadow-glow-danger' : 'border-red-700/80 bg-red-950/70 text-red-100 shadow-glow-danger hover:bg-red-900'"
          [attr.aria-pressed]="video().blackout" (click)="videoSvc.toggleBlackout()" title="Tela preta instantânea (F8)">
          <span class="h-2 w-2 rounded-full bg-red-500" [class.animate-ping]="video().blackout"></span>
          <app-icon name="power" [size]="13" class="text-red-300" />
          <span>{{ video().blackout ? 'LIBERAR TELA (F8)' : 'TELA PRETA (F8)' }}</span>
        </button>

        <button class="flex h-8 w-8 items-center justify-center rounded border border-app-border bg-app-card text-slate-400 transition hover:bg-app-cardHover hover:text-slate-200"
          (click)="settings.panelOpen.set(true)" aria-label="Configurações" title="Configurações">
          <app-icon name="gear" [size]="14" />
        </button>
      </div>
    </header>
  `
})
export class AppHeaderComponent implements OnInit, OnDestroy {
  protected readonly videoSvc = inject(VideoQueueService);
  protected readonly safe = inject(SafeModeService);
  protected readonly countdown = inject(CountdownService);
  protected readonly settings = inject(SettingsService);
  private readonly monitors = inject(MonitorService);
  private readonly audioSvc = inject(AudioQueueService);

  protected readonly video = toSignal(this.videoSvc.state$, { requireSync: true });
  protected readonly connected = toSignal(this.monitors.connected$, { requireSync: true });
  protected readonly displays = toSignal(this.monitors.displays$, { requireSync: true });
  private readonly audio = toSignal(this.audioSvc.state$, { requireSync: true });
  protected readonly audioError = computed(() => this.audio().error);

  protected readonly presets = [5, 10, 15, 30, 45, 60];
  protected readonly cdOpen = signal(false);
  protected readonly cdText = computed(() => formatClock(this.countdown.remainingSec()));
  protected readonly clock = signal(this.now());
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.timer = setInterval(() => this.clock.set(this.now()), 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private now(): string {
    return new Date().toLocaleTimeString('pt-BR', { hour12: false });
  }
}
