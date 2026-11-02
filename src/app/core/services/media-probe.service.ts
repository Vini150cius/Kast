import { Injectable, inject } from '@angular/core';
import { MediaFsPort } from '../ports/media-fs.port';
import { MediaItem } from '../models/media.model';

/**
 * Lê só os metadados (duração/resolução) com um elemento HTML temporário.
 * Sondagens rodam em fila (uma por vez) e o elemento é descartado em seguida,
 * então o arquivo grande nunca fica em memória.
 */
@Injectable({ providedIn: 'root' })
export class MediaProbeService {
  private readonly fs = inject(MediaFsPort);
  private chain: Promise<unknown> = Promise.resolve();

  probe(item: MediaItem): Promise<Partial<MediaItem>> {
    const run = () => this.doProbe(item);
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => undefined);
    return p;
  }

  private doProbe(item: MediaItem): Promise<Partial<MediaItem>> {
    const url = this.fs.toAssetUrl(item.path);
    return new Promise((resolve) => {
      if (item.kind === 'image') {
        const img = new Image();
        img.onload = () => {
          resolve({ widthPx: img.naturalWidth, heightPx: img.naturalHeight });
          img.removeAttribute('src');
        };
        img.onerror = () => resolve({});
        img.src = url;
        return;
      }

      const el = document.createElement(item.kind === 'audio' ? 'audio' : 'video');
      el.preload = 'metadata';
      el.muted = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (result: Partial<MediaItem>) => {
        clearTimeout(timer);
        el.onloadedmetadata = null;
        el.onerror = null;
        el.removeAttribute('src');
        el.load();
        resolve(result);
      };
      timer = setTimeout(() => finish({}), 6000);
      el.onloadedmetadata = () => {
        const durationMs = isFinite(el.duration) ? Math.round(el.duration * 1000) : null;
        if (el instanceof HTMLVideoElement) {
          finish({ durationMs, widthPx: el.videoWidth, heightPx: el.videoHeight });
        } else {
          finish({ durationMs });
        }
      };
      el.onerror = () => finish({});
      el.src = url;
    });
  }
}
