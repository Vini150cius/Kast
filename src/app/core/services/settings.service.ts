import { Injectable, signal } from '@angular/core';

export interface KastSettings {
  defaultImageSec: number;
  defaultTransitionMs: number;
  defaultCrossfadeMs: number;
  defaultVolume: number;
}

export const DEFAULT_SETTINGS: KastSettings = {
  defaultImageSec: 8,
  defaultTransitionMs: 800,
  defaultCrossfadeMs: 3000,
  defaultVolume: 0.8
};

const KEY = 'kast.settings.v1';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly values = signal<KastSettings>(this.load());
  /** Controla a visibilidade do modal de configurações. */
  readonly panelOpen = signal(false);

  save(next: KastSettings): void {
    this.values.set(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage indisponível: vale só para a sessão */
    }
  }

  reset(): void {
    this.save({ ...DEFAULT_SETTINGS });
  }

  private load(): KastSettings {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<KastSettings>) };
    } catch {
      /* ignora */
    }
    return { ...DEFAULT_SETTINGS };
  }
}
