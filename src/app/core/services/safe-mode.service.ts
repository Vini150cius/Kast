import { Injectable, signal } from '@angular/core';

/** Modo Seguro: bloqueia exclusões, reordenação e trocas diretas acidentais. */
@Injectable({ providedIn: 'root' })
export class SafeModeService {
  readonly enabled = signal(false);

  toggle(): void {
    this.enabled.update((v) => !v);
  }
}
