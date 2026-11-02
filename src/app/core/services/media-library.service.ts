import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { MediaFsPort } from '../ports/media-fs.port';
import { MediaItem, RejectedPath } from '../models/media.model';
import { MediaProbeService } from './media-probe.service';

@Injectable({ providedIn: 'root' })
export class MediaLibraryService implements OnDestroy {
  private readonly fs = inject(MediaFsPort);
  private readonly probe = inject(MediaProbeService);
  private readonly sub = new Subscription();

  private readonly itemsSubject = new BehaviorSubject<MediaItem[]>([]);
  private readonly draggingSubject = new BehaviorSubject<boolean>(false);
  private readonly rejectedSubject = new BehaviorSubject<RejectedPath[]>([]);
  private readonly busySubject = new BehaviorSubject<boolean>(false);

  readonly items$ = this.itemsSubject.asObservable();
  readonly dragging$ = this.draggingSubject.asObservable();
  readonly rejected$ = this.rejectedSubject.asObservable();
  readonly busy$ = this.busySubject.asObservable();

  constructor() {
    this.sub.add(
      this.fs.dropEvents().subscribe((e) => {
        if (e.type === 'hover') this.draggingSubject.next(true);
        else if (e.type === 'cancel') this.draggingSubject.next(false);
        else {
          this.draggingSubject.next(false);
          void this.addPaths(e.paths);
        }
      })
    );
  }

  get snapshot(): MediaItem[] {
    return this.itemsSubject.value;
  }

  async addPaths(paths: string[]): Promise<void> {
    if (!paths.length) return;
    this.busySubject.next(true);
    try {
      const result = await this.fs.registerMedia(paths);
      const known = new Set(this.itemsSubject.value.map((i) => i.id));
      const fresh = result.accepted.filter((i) => !known.has(i.id));
      this.itemsSubject.next([...this.itemsSubject.value, ...fresh]);
      this.rejectedSubject.next(result.rejected);
      for (const item of fresh) void this.enrich(item);
    } catch (e) {
      this.rejectedSubject.next([{ path: '', reason: String(e) }]);
    } finally {
      this.busySubject.next(false);
    }
  }

  async pickAndAdd(): Promise<void> {
    await this.addPaths(await this.fs.pickFiles());
  }

  /** Revalida todos os caminhos: marca arquivos que sumiram e atualiza tamanhos. */
  async reload(): Promise<void> {
    const current = this.itemsSubject.value;
    if (!current.length) return;
    this.busySubject.next(true);
    try {
      const result = await this.fs.registerMedia(current.map((i) => i.path));
      const ok = new Map(result.accepted.map((i) => [i.id, i]));
      this.itemsSubject.next(
        current.map((i) => {
          const fresh = ok.get(i.id);
          return fresh ? { ...i, sizeBytes: fresh.sizeBytes, missing: false } : { ...i, missing: true };
        })
      );
    } catch (e) {
      this.rejectedSubject.next([{ path: '', reason: String(e) }]);
    } finally {
      this.busySubject.next(false);
    }
  }

  remove(id: string): void {
    this.itemsSubject.next(this.itemsSubject.value.filter((i) => i.id !== id));
  }

  dismissRejected(): void {
    this.rejectedSubject.next([]);
  }

  private async enrich(item: MediaItem): Promise<void> {
    const meta = await this.probe.probe(item);
    if (!Object.keys(meta).length) return;
    this.itemsSubject.next(this.itemsSubject.value.map((i) => (i.id === item.id ? { ...i, ...meta } : i)));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
