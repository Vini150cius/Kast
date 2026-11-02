import { Injectable, NgZone, inject } from '@angular/core';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { Observable } from 'rxjs';
import { DisplayPort } from '../ports/display.port';
import { DisplayCommand, DisplayProgress } from '../models/display.model';
import { fromTauriEvent } from './tauri-events';

@Injectable()
export class TauriDisplayAdapter extends DisplayPort {
  private readonly zone = inject(NgZone);

  send(command: DisplayCommand): Promise<void> {
    return invoke<void>('send_display_command', { command });
  }
  ended$(): Observable<{ playId: number; label: string }> {
    return fromTauriEvent('display://ended', this.zone);
  }
  ready$(): Observable<{ label: string }> {
    return fromTauriEvent('display://ready', this.zone);
  }
  progress$(): Observable<DisplayProgress> {
    return fromTauriEvent<DisplayProgress>('display://progress', this.zone);
  }
  commands$(): Observable<DisplayCommand> {
    return fromTauriEvent<DisplayCommand>('display://command', this.zone);
  }
  notifyEnded(playId: number, label: string): Promise<void> {
    return emit('display://ended', { playId, label });
  }
  notifyReady(label: string): Promise<void> {
    return emit('display://ready', { label });
  }
  notifyProgress(progress: DisplayProgress): Promise<void> {
    return emit('display://progress', progress);
  }
  toAssetUrl(path: string): string {
    return convertFileSrc(path);
  }
}
