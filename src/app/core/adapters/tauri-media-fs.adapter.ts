import { Injectable, NgZone, inject } from '@angular/core';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open } from '@tauri-apps/plugin-dialog';
import { Observable } from 'rxjs';
import { MediaFsPort } from '../ports/media-fs.port';
import { DropEvent, RegisterResult } from '../models/media.model';

@Injectable()
export class TauriMediaFsAdapter extends MediaFsPort {
  private readonly zone = inject(NgZone);

  registerMedia(paths: string[]): Promise<RegisterResult> {
    return invoke<RegisterResult>('register_media', { paths });
  }

  async pickFiles(): Promise<string[]> {
    const selected = await open({
      multiple: true,
      filters: [
        {
          name: 'Mídia',
          extensions: ['mp3', 'wav', 'flac', 'ogg', 'mp4', 'm4v', 'webm', 'mov', 'ogv', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']
        }
      ]
    });
    if (!selected) return [];
    return Array.isArray(selected) ? selected : [selected];
  }

  /** O Tauri entrega caminhos reais do SO no drop (HTML5 puro não entrega). */
  dropEvents(): Observable<DropEvent> {
    return new Observable<DropEvent>((subscriber) => {
      let unlisten: (() => void) | undefined;
      let closed = false;
      const emit = (e: DropEvent) => this.zone.run(() => subscriber.next(e));
      getCurrentWebview()
        .onDragDropEvent((event) => {
          const p = event.payload;
          if (p.type === 'enter') emit({ type: 'hover' });
          else if (p.type === 'leave') emit({ type: 'cancel' });
          else if (p.type === 'drop') emit({ type: 'drop', paths: p.paths });
        })
        .then((un) => {
          if (closed) un();
          else unlisten = un;
        });
      return () => {
        closed = true;
        unlisten?.();
      };
    });
  }

  toAssetUrl(path: string): string {
    return convertFileSrc(path);
  }
}
