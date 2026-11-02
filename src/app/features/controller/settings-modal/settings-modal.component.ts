import { Component, HostListener, inject, signal } from '@angular/core';
import { IconComponent } from '../../../shared/icon.component';
import { DEFAULT_SETTINGS, KastSettings, SettingsService } from '../../../core/services/settings.service';
import { VideoQueueService } from '../../../core/services/video-queue.service';
import { AudioQueueService } from '../../../core/services/audio-queue.service';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (settings.panelOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" (click)="close()" >
        <div class="w-full max-w-lg overflow-hidden rounded-xl border border-app-borderLight bg-app-surface shadow-2xl" (click)="$event.stopPropagation()"
          role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <header class="flex items-center justify-between border-b border-app-border px-5 py-3">
            <div class="flex items-center gap-3">
              <img src="assets/kast-emblem.png" alt="" class="h-8 w-8" style="mix-blend-mode: screen; -webkit-mask-image: radial-gradient(circle, #000 58%, transparent 100%); mask-image: radial-gradient(circle, #000 58%, transparent 100%)" />
              <h2 id="settings-title" class="text-sm font-bold text-slate-100">Configurações do Kast</h2>
            </div>
            <button class="rounded p-1.5 text-slate-400 hover:bg-app-card hover:text-slate-100" (click)="close()" aria-label="Fechar"><app-icon name="x" [size]="14" /></button>
          </header>

          <div class="space-y-5 px-5 py-4 text-sm text-slate-300">
            <section class="space-y-3">
              <h3 class="text-xs font-semibold text-slate-400">Padrões para novos itens</h3>
              <label class="flex items-center justify-between gap-4">
                <span>Tempo de cada imagem na fila (segundos)</span>
                <input type="number" min="0" max="3600" class="w-24 rounded border border-app-border bg-app-card px-2 py-1 text-slate-100" [value]="draft().defaultImageSec" (input)="set('defaultImageSec', +$any($event.target).value)" />
              </label>
              <label class="flex items-center justify-between gap-4">
                <span>Duração da transição de vídeo (ms)</span>
                <input type="number" min="0" max="3000" step="100" class="w-24 rounded border border-app-border bg-app-card px-2 py-1 text-slate-100" [value]="draft().defaultTransitionMs" (input)="set('defaultTransitionMs', +$any($event.target).value)" />
              </label>
              <label class="flex items-center justify-between gap-4">
                <span>Crossfade de áudio (ms)</span>
                <input type="number" min="0" max="8000" step="250" class="w-24 rounded border border-app-border bg-app-card px-2 py-1 text-slate-100" [value]="draft().defaultCrossfadeMs" (input)="set('defaultCrossfadeMs', +$any($event.target).value)" />
              </label>
              <label class="flex items-center justify-between gap-4">
                <span>Volume inicial (%)</span>
                <input type="number" min="0" max="100" class="w-24 rounded border border-app-border bg-app-card px-2 py-1 text-slate-100" [value]="draft().defaultVolume * 100" (input)="set('defaultVolume', +$any($event.target).value / 100)" />
              </label>
              <p class="text-xs text-slate-500">Os valores também são aplicados aos controles agora e ficam salvos para as próximas aberturas.</p>
            </section>

            <section>
              <h3 class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-400"><app-icon name="keyboard" [size]="13" />Atalhos</h3>
              <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                <dt><kbd class="rounded border border-app-border bg-app-card px-1.5 py-0.5 font-mono">F8</kbd></dt><dd>Tela preta (liga e desliga)</dd>
                <dt><kbd class="rounded border border-app-border bg-app-card px-1.5 py-0.5 font-mono">F11</kbd></dt><dd>Abrir ou fechar os exibidores</dd>
                <dt><kbd class="rounded border border-app-border bg-app-card px-1.5 py-0.5 font-mono">Ctrl + O</kbd></dt><dd>Adicionar arquivos à biblioteca</dd>
              </dl>
            </section>
          </div>

          <footer class="flex items-center justify-between border-t border-app-border px-5 py-3">
            <button class="text-xs text-slate-400 underline hover:text-slate-100" (click)="restore()">Restaurar padrões</button>
            <div class="flex gap-2">
              <button class="rounded bg-app-card px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-app-cardHover" (click)="close()">Cancelar</button>
              <button class="rounded bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400" (click)="save()">Salvar</button>
            </div>
          </footer>
        </div>
      </div>
    }
  `
})
export class SettingsModalComponent {
  protected readonly settings = inject(SettingsService);
  private readonly video = inject(VideoQueueService);
  private readonly audio = inject(AudioQueueService);
  protected readonly draft = signal<KastSettings>({ ...this.settings.values() });

  @HostListener('window:keydown.escape')
  protected onEscape(): void {
    if (this.settings.panelOpen()) this.close();
  }

  protected set<K extends keyof KastSettings>(key: K, value: KastSettings[K]): void {
    this.draft.update((d) => ({ ...d, [key]: Number.isFinite(value) ? value : d[key] }));
  }

  protected save(): void {
    const d = this.draft();
    this.settings.save(d);
    this.video.setTransitionMs(d.defaultTransitionMs);
    this.audio.setCrossfadeMs(d.defaultCrossfadeMs);
    void this.audio.setVolume(d.defaultVolume);
    this.close();
  }

  protected restore(): void {
    this.draft.set({ ...DEFAULT_SETTINGS });
  }

  protected close(): void {
    this.draft.set({ ...this.settings.values() });
    this.settings.panelOpen.set(false);
  }
}
