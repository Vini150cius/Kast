export type MediaKind = 'audio' | 'video' | 'image';

/** Guardamos somente o caminho absoluto, nunca o conteúdo do arquivo. */
export interface MediaItem {
  id: string;
  path: string;
  name: string;
  kind: MediaKind;
  sizeBytes: number;
  /** Preenchidos pela sondagem de metadados (sem carregar o arquivo inteiro). */
  durationMs?: number | null;
  widthPx?: number;
  heightPx?: number;
  missing?: boolean;
}

export interface RejectedPath {
  path: string;
  reason: string;
}

export interface RegisterResult {
  accepted: MediaItem[];
  rejected: RejectedPath[];
}

export type DropEvent = { type: 'hover' } | { type: 'cancel' } | { type: 'drop'; paths: string[] };
