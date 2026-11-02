import { Component, HostListener, OnInit, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MonitorService } from '../../core/services/monitor.service';
import { MediaLibraryService } from '../../core/services/media-library.service';
import { VideoQueueService } from '../../core/services/video-queue.service';
import { AppHeaderComponent } from './app-header/app-header.component';
import { MediaLibraryComponent } from './media-library/media-library.component';
import { AudioPanelComponent } from './audio-panel/audio-panel.component';
import { VideoPanelComponent } from './video-panel/video-panel.component';
import { MonitorPanelComponent } from './monitor-panel/monitor-panel.component';
import { SettingsModalComponent } from './settings-modal/settings-modal.component';

/** Tempo mínimo da splash, para a animação de abertura aparecer inteira. */
const MIN_SPLASH_MS = 3800;

@Component({
  selector: 'app-controller',
  standalone: true,
  imports: [AppHeaderComponent, MediaLibraryComponent, AudioPanelComponent, VideoPanelComponent, MonitorPanelComponent, SettingsModalComponent],
  template: `
    <div class="flex h-screen flex-col bg-app-base text-slate-200">
      <app-header />
      <main class="flex min-h-0 flex-1 gap-2 bg-app-base p-2">
        <app-media-library class="block w-80 shrink-0" />
        <app-video-panel class="block min-w-[420px] flex-1" />
        <app-audio-panel class="block w-[21rem] shrink-0" />
      </main>
      <app-monitor-panel />
    </div>

    @if (dragging()) {
      <div class="pointer-events-none fixed inset-2 z-40 flex items-center justify-center rounded-xl border-2 border-dashed border-amber-500 bg-app-base/85">
        <p class="text-lg font-semibold text-amber-400">Solte para adicionar à biblioteca</p>
      </div>
    }
    <app-settings-modal />
  `
})
export class ControllerComponent implements OnInit {
  private readonly monitors = inject(MonitorService);
  private readonly library = inject(MediaLibraryService);
  private readonly video = inject(VideoQueueService);
  protected readonly dragging = toSignal(this.library.dragging$, { requireSync: true });

  async ngOnInit(): Promise<void> {
    const minDelay = new Promise<void>((r) => setTimeout(r, MIN_SPLASH_MS));
    await Promise.all([this.monitors.refresh(), minDelay]);
    await this.monitors.notifyReady(); // fecha a splash e mostra esta janela
  }

  @HostListener('window:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'F8') {
      e.preventDefault();
      void this.video.toggleBlackout();
    } else if (e.key === 'F11') {
      e.preventDefault();
      void this.monitors.toggleDisplays();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      void this.library.pickAndAdd();
    }
  }
}
