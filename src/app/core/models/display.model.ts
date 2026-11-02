import { MediaItem } from './media.model';

export type TransitionStyle = 'fade' | 'cut' | 'dissolve';

export type DisplayCommand =
  | { type: 'show'; playId: number; path: string; kind: 'video' | 'image'; loopPlayback: boolean; transitionMs: number; style: TransitionStyle }
  | { type: 'clear'; transitionMs: number }
  | { type: 'freeze'; frozen: boolean }
  | { type: 'blackout'; on: boolean; transitionMs: number }
  | { type: 'seek'; positionMs: number };

export interface DisplayProgress {
  playId: number;
  positionMs: number;
  durationMs: number | null;
  label: string;
}

export interface VideoQueueItem {
  media: MediaItem;
  /** Vídeo: repete até o operador avançar. */
  loop: boolean;
  /** Imagem: tempo na tela antes de avançar (ms). 0 = fica até o operador mudar. */
  durationMs: number;
}

export type VideoStatus = 'idle' | 'playing' | 'fallback';

export interface VideoState {
  queue: VideoQueueItem[];
  index: number;
  status: VideoStatus;
  playId: number;
  transitionMs: number;
  transitionStyle: TransitionStyle;
  fallback: MediaItem | null;
  autoAdvance: boolean;
  frozen: boolean;
  blackout: boolean;
  positionMs: number;
  durationMs: number | null;
  error: string | null;
}
