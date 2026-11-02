import { Injectable, NgZone, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { Observable } from 'rxjs';
import { AudioPort } from '../ports/audio.port';
import { AudioProgress, LoopMode } from '../models/audio.model';
import { fromTauriEvent } from './tauri-events';

@Injectable()
export class TauriAudioAdapter extends AudioPort {
  private readonly zone = inject(NgZone);

  play(path: string, crossfadeMs: number, loop: LoopMode, volume: number): Promise<void> {
    return invoke<void>('audio_play', { path, crossfadeMs, loopMode: loop, volume });
  }
  pause(): Promise<void> {
    return invoke<void>('audio_pause');
  }
  resume(): Promise<void> {
    return invoke<void>('audio_resume');
  }
  stop(fadeMs: number): Promise<void> {
    return invoke<void>('audio_stop', { fadeMs });
  }
  setVolume(volume: number): Promise<void> {
    return invoke<void>('audio_set_volume', { volume });
  }
  setLoop(loop: LoopMode): Promise<void> {
    return invoke<void>('audio_set_loop', { loopMode: loop });
  }
  progress$(): Observable<AudioProgress> {
    return fromTauriEvent<AudioProgress>('audio://progress', this.zone);
  }
  ended$(): Observable<{ path: string }> {
    return fromTauriEvent<{ path: string }>('audio://ended', this.zone);
  }
  error$(): Observable<string> {
    return fromTauriEvent<string>('audio://error', this.zone);
  }
}
