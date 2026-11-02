import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IconComponent } from '../../../shared/icon.component';
import { MsToTimePipe } from '../../../shared/pipes/ms-to-time.pipe';
import { AudioQueueService } from '../../../core/services/audio-queue.service';
import { SafeModeService } from '../../../core/services/safe-mode.service';
import { RepeatMode } from '../../../core/models/audio.model';
import { volumeToDb } from '../../../shared/utils/format';

@Component({
  selector: 'app-audio-panel',
  standalone: true,
  imports: [IconComponent, MsToTimePipe],
  template: `
    <section class="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-app-border bg-app-surface shadow-sm" aria-label="Módulo de áudio">
      <!-- Cabeçalho com VU -->
      <div class="flex items-center justify-between border-b border-app-border p-3">
        <div class="flex items-center gap-2">
          <app-icon name="sliders" [size]="15" class="text-amber-400" />
          <h2 class="text-sm font-bold tracking-wide text-slate-100">Módulo de Áudio</h2>
        </div>
        <div class="flex items-center gap-1.5 rounded border border-app-border bg-app-base px-2 py-1" title="Nível de saída (pico)">
          <span class="mr-1 font-mono text-[9px] text-slate-400">VU</span>
          <div class="flex h-4 w-24 overflow-hidden rounded-sm bg-slate-800" role="meter" aria-label="Nível de áudio" [attr.aria-valuenow]="vu()" aria-valuemin="0" aria-valuemax="100">
            <div class="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 transition-[width] duration-100" [style.width.%]="vu()"></div>
          </div>
        </div>
      </div>

      <!-- Faixa atual -->
      <div class="space-y-2 border-b border-app-border bg-app-card/80 p-3">
        <div class="min-w-0">
          <span class="flex items-center text-[9px] font-bold tracking-wider" [class]="s().status === 'playing' ? 'text-emerald-400' : 'text-slate-400'">
            @if (s().status === 'playing') { <span class="mr-1 h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400"></span> }
            {{ s().status === 'playing' ? 'Reproduzindo faixa' : s().status === 'paused' ? 'Pausado' : 'Parado' }}
          </span>
          <p class="mt-0.5 truncate text-xs font-bold text-slate-100">{{ current()?.name ?? 'Nenhuma faixa selecionada' }}</p>
          <p class="truncate text-[10px] text-slate-400">{{ subtitle() }}</p>
        </div>

        <div class="space-y-1">
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label="Progresso da faixa" [attr.aria-valuenow]="progress()" aria-valuemin="0" aria-valuemax="100">
            <div class="h-full rounded-full bg-amber-400" [style.width.%]="progress()"></div>
          </div>
          <div class="flex justify-between font-mono text-[10px] text-slate-400">
            <span>{{ s().positionMs | msToTime }}</span><span class="text-slate-300">{{ s().durationMs | msToTime }}</span>
          </div>
        </div>

        <div class="flex items-center justify-center gap-1 pt-1">
          <button class="rounded p-2 text-slate-400 transition hover:bg-app-card hover:text-slate-200 disabled:opacity-40" [disabled]="!s().queue.length" (click)="audio.prev()" title="Faixa anterior (ou início da faixa)" aria-label="Faixa anterior"><app-icon name="skip-back" [size]="13" /></button>
          <button class="flex items-center gap-1.5 rounded bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-950 shadow-glow-accent transition hover:bg-amber-400 disabled:opacity-40" [disabled]="!s().queue.length" (click)="audio.togglePause()" title="Tocar ou pausar">
            <app-icon [name]="s().status === 'playing' ? 'pause' : 'play'" [size]="12" />
            <span>{{ s().status === 'playing' ? 'Pausar' : s().status === 'paused' ? 'Continuar' : 'Tocar' }}</span>
          </button>
          <button class="rounded p-2 text-slate-400 transition hover:bg-app-card hover:text-slate-200 disabled:opacity-40" [disabled]="!hasNext()" (click)="audio.next()" title="Próxima faixa" aria-label="Próxima faixa"><app-icon name="skip-forward" [size]="13" /></button>
          <button class="rounded p-2 text-slate-400 transition hover:bg-app-card hover:text-rose-400 disabled:opacity-40" [disabled]="s().status === 'stopped'" (click)="audio.stop()" title="Parar áudio" aria-label="Parar áudio"><app-icon name="stop" [size]="12" /></button>
        </div>
      </div>

      <!-- Faders -->
      <div class="space-y-3 border-b border-app-border bg-app-surface/50 p-3">
        <div>
          <div class="mb-1 flex justify-between text-xs">
            <label for="vol" class="flex items-center gap-1 font-medium text-slate-300"><app-icon name="volume" [size]="13" class="text-amber-400" />Volume master:</label>
            <span class="font-mono text-xs font-bold text-amber-400">{{ (s().volume * 100).toFixed(0) }}% ({{ db() }})</span>
          </div>
          <input id="vol" type="range" class="w-full" min="0" max="100" [value]="s().volume * 100" (input)="audio.setVolume(+$any($event.target).value / 100)" />
        </div>

        <div>
          <div class="mb-1 flex justify-between text-xs">
            <label for="xf" class="flex items-center gap-1 font-medium text-slate-300"><app-icon name="shuffle" [size]="13" class="text-amber-400" />Crossfade:</label>
            <span class="font-mono text-xs font-bold text-amber-400">{{ (s().crossfadeMs / 1000).toFixed(1) }}s</span>
          </div>
          <input id="xf" type="range" class="w-full" min="0" max="8" step="0.5" [value]="s().crossfadeMs / 1000" (input)="audio.setCrossfadeMs(+$any($event.target).value * 1000)" />
        </div>

        <div class="flex items-center justify-between pt-1">
          <label for="loop" class="flex items-center gap-1 text-xs font-medium text-slate-300"><app-icon name="repeat" [size]="13" class="text-amber-400" />Modo loop:</label>
          <select id="loop" class="rounded border border-app-border bg-app-card px-2.5 py-1 text-xs text-slate-200 focus:border-amber-500" [value]="s().repeat" (change)="audio.setRepeat($any($event.target).value)">
            @for (o of repeatOptions; track o.id) { <option [value]="o.id">{{ o.label }}</option> }
          </select>
        </div>

        @if (s().repeat === 'segment') {
          <div class="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <label for="ls">De</label>
            <input id="ls" #a type="number" min="0" step="1" class="w-16 rounded border border-app-border bg-app-card px-1.5 py-1 text-slate-100" [value]="s().segment.startMs / 1000" />
            <label for="le">até</label>
            <input id="le" #b type="number" min="0" step="1" class="w-16 rounded border border-app-border bg-app-card px-1.5 py-1 text-slate-100" [value]="s().segment.endMs / 1000" />
            <span class="text-slate-500">s</span>
            <button class="rounded bg-app-card px-2 py-1 text-xs font-medium hover:bg-app-cardHover" (click)="audio.setSegment(+a.value * 1000, +b.value * 1000)">Aplicar</button>
          </div>
        }
        @if (s().error) { <p class="text-xs text-red-400" role="alert">{{ s().error }}</p> }
      </div>

      <!-- Fila -->
      <div class="flex min-h-0 flex-1 flex-col p-3">
        <div class="mb-2 flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-bold tracking-wider text-slate-400">Fila de áudio</span>
            <span class="rounded border border-app-border bg-app-card px-1.5 font-mono text-[10px] text-slate-300">{{ s().queue.length }}</span>
          </div>
          <button class="text-xs font-medium text-slate-400 transition hover:text-rose-400 disabled:opacity-40 disabled:hover:text-slate-400" [disabled]="!s().queue.length || safe.enabled()" (click)="audio.clear()">Limpar</button>
        </div>

        <div class="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
          @for (item of s().queue; track $index) {
            <div class="group flex items-center justify-between rounded border p-2 text-xs transition hover:bg-app-cardHover"
              [class]="isCurrent($index) ? 'border-emerald-600/50 bg-app-cardHover' : 'border-app-border bg-app-card'">
              <button class="min-w-0 flex-1 pr-2 text-left disabled:cursor-not-allowed" [disabled]="safe.enabled()" (click)="audio.playAt($index, s().status === 'playing' ? s().crossfadeMs : 0)" [title]="item.path">
                <div class="truncate font-semibold group-hover:text-amber-400" [class]="isCurrent($index) ? 'text-emerald-300' : 'text-slate-200'">{{ pad($index + 1) }}. {{ item.name }}</div>
                <div class="font-mono text-[10px] text-slate-500">{{ item.durationMs | msToTime }} • {{ trackNote($index) }}</div>
              </button>
              <span class="mr-1 font-mono text-[11px] text-slate-400">{{ item.durationMs | msToTime }}</span>
              <div class="flex items-center opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                <button class="rounded p-1 text-slate-400 hover:text-amber-400 disabled:opacity-30" [disabled]="$index === 0 || safe.enabled()" (click)="audio.move($index, -1)" aria-label="Subir"><app-icon name="chevron-up" [size]="12" /></button>
                <button class="rounded p-1 text-slate-400 hover:text-amber-400 disabled:opacity-30" [disabled]="$index === s().queue.length - 1 || safe.enabled()" (click)="audio.move($index, 1)" aria-label="Descer"><app-icon name="chevron-down" [size]="12" /></button>
                <button class="rounded p-1 text-slate-400 hover:text-rose-400 disabled:opacity-30" [disabled]="safe.enabled()" (click)="audio.removeAt($index)" aria-label="Remover da fila"><app-icon name="x" [size]="12" /></button>
              </div>
            </div>
          } @empty {
            <p class="px-3 py-8 text-center text-xs text-slate-500">A fila está vazia. Use o botão + na biblioteca para enviar músicas.</p>
          }
        </div>
      </div>
    </section>
  `
})
export class AudioPanelComponent {
  protected readonly audio = inject(AudioQueueService);
  protected readonly safe = inject(SafeModeService);
  protected readonly s = toSignal(this.audio.state$, { requireSync: true });

  protected readonly repeatOptions: { id: RepeatMode; label: string }[] = [
    { id: 'off', label: 'Desligado' },
    { id: 'track', label: 'Repetir faixa' },
    { id: 'queue', label: 'Repetir toda a fila' },
    { id: 'segment', label: 'Repetir trecho' }
  ];

  protected readonly current = computed(() => {
    const s = this.s();
    return s.status !== 'stopped' || s.index >= 0 ? s.queue[s.index] : undefined;
  });
  protected readonly subtitle = computed(() => {
    const s = this.s();
    return this.current() ? `Faixa ${s.index + 1} de ${s.queue.length}` : `${s.queue.length} faixa(s) na fila`;
  });
  protected readonly progress = computed(() => {
    const s = this.s();
    return s.durationMs ? Math.min(100, (s.positionMs / s.durationMs) * 100) : 0;
  });
  protected readonly vu = computed(() => Math.min(100, Math.round(Math.sqrt(this.s().level) * 100)));
  protected readonly db = computed(() => volumeToDb(this.s().volume));
  protected readonly hasNext = computed(() => {
    const s = this.s();
    return s.index + 1 < s.queue.length || (s.repeat === 'queue' && s.queue.length > 0);
  });

  protected isCurrent(i: number): boolean {
    return this.s().index === i && this.s().status !== 'stopped';
  }

  protected pad(n: number): string {
    return n.toString().padStart(2, '0');
  }

  protected trackNote(i: number): string {
    if (this.isCurrent(i)) return this.s().status === 'paused' ? 'Pausada' : 'Tocando';
    const s = this.s();
    if (i === s.index + 1 || (s.repeat === 'queue' && i === 0 && s.index === s.queue.length - 1)) {
      return s.crossfadeMs > 0 ? 'Auto-crossfade' : 'A seguir';
    }
    return i <= s.index ? 'Tocada' : 'Em espera';
  }
}
