import { Observable } from 'rxjs';
import { AudioProgress, LoopMode } from '../models/audio.model';

export abstract class AudioPort {
  abstract play(path: string, crossfadeMs: number, loop: LoopMode, volume: number): Promise<void>;
  abstract pause(): Promise<void>;
  abstract resume(): Promise<void>;
  abstract stop(fadeMs: number): Promise<void>;
  abstract setVolume(volume: number): Promise<void>;
  abstract setLoop(loop: LoopMode): Promise<void>;
  abstract progress$(): Observable<AudioProgress>;
  abstract ended$(): Observable<{ path: string }>;
  abstract error$(): Observable<string>;
}
