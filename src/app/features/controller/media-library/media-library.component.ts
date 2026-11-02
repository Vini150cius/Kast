import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IconComponent } from '../../../shared/icon.component';
import { MediaLibraryService } from '../../../core/services/media-library.service';
import { AudioQueueService } from '../../../core/services/audio-queue.service';
import { VideoQueueService } from '../../../core/services/video-queue.service';
import { SafeModeService } from '../../../core/services/safe-mode.service';
import { MediaItem, MediaKind } from '../../../core/models/media.model';
import { MsToTimePipe } from '../../../shared/pipes/ms-to-time.pipe';
import { formatBytes, resolutionLabel } from '../../../shared/utils/format';

type Filter = 'all' | MediaKind;

@Component({
  selector: 'app-media-library',
  standalone: true,
  imports: [IconComponent, MsToTimePipe],
  template: `
    <section class="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-app-border bg-app-surface shadow-sm" aria-label="Biblioteca">
      <div class="flex items-center justify-between border-b border-app-border p-3">
        <div class="flex items-center gap-2">
          <app-icon name="folder" [size]="15" class="text-amber-400" />
          <h2 class="text-sm font-bold tracking-wide text-slate-100">Biblioteca</h2>
          <span class="rounded-full border border-app-border bg-app-card px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{{ items().length }}</span>
        </div>
        <button class="flex items-center gap-1.5 rounded bg-amber-500 px-2.5 py-1 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-amber-600"
          (click)="library.pickAndAdd()" title="Importar arquivos de mídia (Ctrl + O)">
          <app-icon name="plus" [size]="11" /><span>Adicionar</span><span class="hidden font-mono text-[9px] opacity-75 xl:inline">^O</span>
        </button>
      </div>

      <div class="space-y-2 border-b border-app-border px-3 pb-2 pt-2.5">
        <div class="relative">
          <app-icon name="search" [size]="12" class="absolute left-2.5 top-2 text-slate-500" />
          <input type="text" class="w-full rounded border border-app-border bg-app-card py-1.5 pl-8 pr-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-amber-500/70 focus:outline-none focus:ring-1 focus:ring-amber-500/70"
            placeholder="Buscar mídias..." aria-label="Buscar mídias" [value]="query()" (input)="query.set($any($event.target).value)" />
        </div>
        <div class="flex items-center gap-1" role="tablist" aria-label="Filtrar por tipo">
          @for (t of tabs; track t.id) {
            <button role="tab" [attr.aria-selected]="filter() === t.id"
              class="flex-1 rounded px-2 py-1 text-[11px] font-medium transition"
              [class]="filter() === t.id ? 'border border-amber-500/30 bg-amber-500/15 text-amber-400' : 'border border-transparent text-slate-400 hover:bg-app-card hover:text-slate-200'"
              (click)="filter.set(t.id)">{{ t.label }}</button>
          }
        </div>
      </div>

      <button class="m-2.5 flex items-center justify-center rounded border border-dashed border-app-borderLight/60 bg-app-card/30 p-3 text-center transition hover:border-amber-500/60 hover:bg-amber-500/5"
        (click)="library.pickAndAdd()">
        <span class="space-y-1">
          <app-icon name="upload" [size]="20" class="text-amber-400/80" />
          <span class="block text-[11px] font-medium text-slate-300">Solte vídeos, imagens ou áudios aqui</span>
          <span class="block text-[10px] text-slate-500">MP4, MOV, WEBM, PNG, JPG, MP3, WAV, FLAC, OGG</span>
        </span>
      </button>

      @if (rejected().length) {
        <div class="mx-2.5 mb-2 rounded border border-red-500/40 bg-red-500/10 p-2 text-[11px] text-red-300" role="alert">
          <div class="mb-1 flex justify-between">
            <span class="font-semibold">{{ rejected().length }} arquivo(s) recusado(s)</span>
            <button class="underline" (click)="library.dismissRejected()">Dispensar</button>
          </div>
          @for (r of rejected(); track $index) {
            <p class="truncate" [title]="r.path">{{ r.reason }}{{ r.path ? ': ' + r.path : '' }}</p>
          }
        </div>
      }

      <div class="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        <div class="px-1 py-0.5 text-[10px] font-bold tracking-wider text-slate-500">Arquivos do evento</div>

        @for (item of visible(); track item.id) {
          <div class="group relative flex items-center gap-2.5 rounded border bg-app-card p-2 transition hover:bg-app-cardHover"
            [class]="isFallback(item) ? 'border-amber-500/40' : 'border-app-border'">
            <div class="relative flex h-8 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-app-border bg-slate-900" [class]="iconColor(item)">
              <app-icon [name]="iconName(item)" [size]="14" />
              @if (res(item); as r) {
                <span class="absolute bottom-0 right-0 bg-black/80 px-0.5 font-mono text-[8px] text-slate-300">{{ r }}</span>
              }
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-xs font-semibold text-slate-200 group-hover:text-amber-400" [title]="item.path">{{ item.name }}</div>
              <div class="flex items-center gap-1.5 text-[10px] text-slate-400">
                @if (item.kind !== 'image') { <span class="font-mono">{{ item.durationMs | msToTime }}</span><span>•</span> }
                <span class="font-mono">{{ bytes(item) }}</span>
                @if (item.missing) { <span>•</span><span class="font-semibold text-red-400">Arquivo ausente</span> }
                @else if (isFallback(item)) { <span class="rounded border border-amber-500/30 bg-amber-500/20 px-1 text-[9px] font-semibold text-amber-300">Cena fallback</span> }
                @else if (queued(item)) { <span>•</span><span class="text-sky-400">Na fila</span> }
                @else { <span>•</span><span class="text-emerald-400">Pronto</span> }
              </div>
            </div>
            <div class="flex items-center opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
              <button class="rounded p-1.5 text-slate-400 hover:text-amber-400 disabled:opacity-30 disabled:hover:text-slate-400" [disabled]="safe.enabled() || !!item.missing"
                (click)="playNow(item)" [title]="item.kind === 'audio' ? 'Tocar agora' : 'Exibir imediatamente'" [attr.aria-label]="item.kind === 'audio' ? 'Tocar agora' : 'Exibir imediatamente'">
                <app-icon [name]="item.kind === 'audio' ? 'headphones' : 'play'" [size]="12" />
              </button>
              <button class="rounded p-1.5 text-slate-400 hover:text-amber-400 disabled:opacity-30" [disabled]="!!item.missing" (click)="enqueue(item)" title="Adicionar à fila" aria-label="Adicionar à fila">
                <app-icon name="plus" [size]="12" />
              </button>
              @if (item.kind === 'image') {
                <button class="rounded p-1.5 hover:text-amber-400 disabled:opacity-30" [class]="isFallback(item) ? 'text-amber-400' : 'text-slate-400'" [disabled]="safe.enabled() || !!item.missing"
                  (click)="toggleFallback(item)" [title]="isFallback(item) ? 'Remover como cena de fundo' : 'Usar como cena de fundo'" aria-label="Alternar cena de fundo">
                  <app-icon name="eye" [size]="12" />
                </button>
              }
              <button class="rounded p-1.5 text-slate-400 hover:text-red-400 disabled:opacity-30 disabled:hover:text-slate-400" [disabled]="safe.enabled()"
                (click)="library.remove(item.id)" title="Remover da biblioteca" aria-label="Remover da biblioteca">
                <app-icon name="x" [size]="12" />
              </button>
            </div>
          </div>
        } @empty {
          <p class="px-3 py-8 text-center text-xs text-slate-500">
            {{ items().length ? 'Nenhum arquivo corresponde à busca.' : 'A biblioteca está vazia. Arraste arquivos para cá ou use Adicionar.' }}
          </p>
        }
      </div>

      <div class="flex items-center justify-between border-t border-app-border p-2.5 font-mono text-[11px] text-slate-400">
        <span>{{ items().length }} itens • {{ totalSize() }}</span>
        <button class="flex items-center gap-1 transition hover:text-amber-400 disabled:opacity-40" [disabled]="busy() || !items().length" (click)="library.reload()" title="Revalida os arquivos no disco">
          <app-icon name="refresh" [size]="11" [class.animate-spin]="busy()" />Recarregar
        </button>
      </div>
    </section>
  `
})
export class MediaLibraryComponent {
  protected readonly library = inject(MediaLibraryService);
  private readonly audio = inject(AudioQueueService);
  private readonly video = inject(VideoQueueService);
  protected readonly safe = inject(SafeModeService);

  protected readonly items = toSignal(this.library.items$, { requireSync: true });
  protected readonly rejected = toSignal(this.library.rejected$, { requireSync: true });
  protected readonly busy = toSignal(this.library.busy$, { requireSync: true });
  private readonly audioState = toSignal(this.audio.state$, { requireSync: true });
  private readonly videoState = toSignal(this.video.state$, { requireSync: true });

  protected readonly query = signal('');
  protected readonly filter = signal<Filter>('all');
  protected readonly tabs: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'video', label: 'Vídeos' },
    { id: 'image', label: 'Imagens' },
    { id: 'audio', label: 'Áudio' }
  ];

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.filter();
    return this.items().filter((i) => (f === 'all' || i.kind === f) && (!q || i.name.toLowerCase().includes(q)));
  });

  protected readonly totalSize = computed(() => formatBytes(this.items().reduce((sum, i) => sum + i.sizeBytes, 0)));

  protected iconName(i: MediaItem): string {
    return i.kind === 'audio' ? 'music' : i.kind === 'image' ? 'image' : i.name.toLowerCase().endsWith('.mov') ? 'film' : 'video';
  }

  protected iconColor(i: MediaItem): string {
    return i.kind === 'audio' ? 'text-purple-400' : i.kind === 'image' ? 'text-sky-400' : 'text-amber-400';
  }

  protected res(i: MediaItem): string | null {
    return i.kind === 'audio' ? null : resolutionLabel(i.widthPx, i.heightPx);
  }

  protected bytes(i: MediaItem): string {
    return formatBytes(i.sizeBytes);
  }

  protected isFallback(i: MediaItem): boolean {
    return this.videoState().fallback?.id === i.id;
  }

  protected queued(i: MediaItem): boolean {
    return i.kind === 'audio'
      ? this.audioState().queue.some((q) => q.id === i.id)
      : this.videoState().queue.some((q) => q.media.id === i.id);
  }

  protected playNow(i: MediaItem): void {
    if (i.kind === 'audio') void this.audio.playNow(i);
    else void this.video.showNow(i);
  }

  protected enqueue(i: MediaItem): void {
    if (i.kind === 'audio') this.audio.enqueue(i);
    else this.video.enqueue(i);
  }

  protected toggleFallback(i: MediaItem): void {
    void this.video.setFallback(this.isFallback(i) ? null : i);
  }
}
