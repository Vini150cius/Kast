import { MediaItem } from './media.model';

export type LoopMode =
  | { mode: 'off' }
  | { mode: 'track' }
  | { mode: 'segment'; startMs: number; endMs: number };

/** Modo de repetição mostrado na interface. 'queue' é resolvido no controlador. */
export type RepeatMode = 'off' | 'track' | 'queue' | 'segment';

export interface AudioProgress {
  path: string;
  positionMs: number;
  durationMs: number | null;
  playing: boolean;
  level: number;
}

export type AudioStatus = 'stopped' | 'playing' | 'paused';

export interface AudioState {
  queue: MediaItem[];
  index: number;
  status: AudioStatus;
  positionMs: number;
  durationMs: number | null;
  level: number;
  volume: number;
  repeat: RepeatMode;
  segment: { startMs: number; endMs: number };
  crossfadeMs: number;
  error: string | null;
}
