import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IconComponent } from '../../../shared/icon.component';
import { MonitorService } from '../../../core/services/monitor.service';

@Component({
  selector: 'app-monitor-panel',
  standalone: true,
  imports: [IconComponent],
  template: `
    <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-app-border bg-app-surface px-4 py-2 text-xs shadow-lg" aria-label="Monitores">
      <div class="flex items-center gap-3 overflow-x-auto">
        <div class="flex shrink-0 items-center gap-1.5 font-bold text-slate-300">
          <app-icon name="monitor" [size]="14" class="text-amber-400" />
          <span>Monitores detectados ({{ monitors().length }}):</span>
        </div>
        @for (m of monitors(); track m.index) {
          @if (m.isPrimary) {
            <div class="flex shrink-0 items-center gap-2 rounded border border-app-border bg-app-card px-2.5 py-1 text-[11px]">
              <span class="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
              <span class="font-semibold text-slate-300">Monitor {{ m.index + 1 }}:</span>
              <span class="font-mono text-slate-400">Painel de controle ({{ m.width }}x{{ m.height }})</span>
            </div>
          } @else if (isActive(m.index)) {
            <div class="flex shrink-0 items-center gap-2 rounded border border-emerald-600/60 bg-emerald-950/60 px-2.5 py-1 text-[11px] text-emerald-200 shadow-sm">
              <span class="h-2 w-2 animate-pulse rounded-full bg-emerald-400"></span>
              <span class="font-bold text-emerald-300">Monitor {{ m.index + 1 }} (projetor / painel):</span>
              <span class="font-mono text-emerald-400">{{ m.width }}x{{ m.height }}</span>
              <span class="rounded bg-emerald-800 px-1.5 text-[9px] font-black text-emerald-100">ATIVO</span>
            </div>
          } @else {
            <div class="flex shrink-0 items-center gap-2 rounded border border-app-border bg-app-card px-2.5 py-1 text-[11px]">
              <span class="h-1.5 w-1.5 rounded-full bg-slate-500"></span>
              <span class="font-semibold text-slate-300">Monitor {{ m.index + 1 }}:</span>
              <span class="font-mono text-slate-400">{{ m.width }}x{{ m.height }} • inativo</span>
            </div>
          }
        }
        @if (monitors().length < 2 && !hasPreview()) {
          <span class="shrink-0 text-[11px] text-amber-300">Só 1 monitor detectado. No Windows use Win+P → Estender.</span>
        }
        @if (hasPreview()) {
          <div class="flex shrink-0 items-center gap-2 rounded border border-sky-600/50 bg-sky-950/40 px-2.5 py-1 text-[11px] text-sky-200">
            <span class="h-2 w-2 animate-pulse rounded-full bg-sky-400"></span>
            <span class="font-semibold">Janela de pré-visualização</span>
            <span class="font-mono text-sky-300">sem monitor secundário</span>
          </div>
        }
      </div>

      <div class="flex items-center gap-2.5">
        <span class="hidden font-mono text-[11px] text-slate-400 xl:inline">Janelas abertas: <strong class="text-slate-200">{{ displays().length }} de exibição</strong></span>
        <button class="flex items-center gap-1.5 rounded border border-app-border bg-app-card px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-app-cardHover" (click)="svc.refresh()">
          <app-icon name="refresh" [size]="12" class="text-amber-400" /><span>Atualizar</span>
        </button>
        <button class="flex items-center gap-1.5 rounded px-3.5 py-1 text-xs font-bold transition"
          [class]="displays().length ? 'border border-app-borderLight bg-app-card text-slate-100 hover:bg-app-cardHover' : 'bg-amber-500 text-slate-950 shadow-glow-accent hover:bg-amber-400'"
          (click)="svc.toggleDisplays()" title="Atalho: F11">
          <app-icon name="window" [size]="12" />
          <span>{{ displays().length ? 'Fechar exibidores (F11)' : 'Abrir exibidores (F11)' }}</span>
        </button>
      </div>
      @if (error()) { <p class="w-full text-xs text-red-400" role="alert">{{ error() }}</p> }
    </footer>
  `
})
export class MonitorPanelComponent {
  protected readonly svc = inject(MonitorService);
  protected readonly monitors = toSignal(this.svc.monitors$, { requireSync: true });
  protected readonly displays = toSignal(this.svc.displays$, { requireSync: true });
  protected readonly error = toSignal(this.svc.error$, { requireSync: true });
  protected readonly hasPreview = computed(() => this.displays().includes('display-preview'));

  protected isActive(index: number): boolean {
    return this.displays().includes(`display-${index}`);
  }
}
