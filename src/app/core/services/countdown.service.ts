import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import { Subscription, interval } from 'rxjs';

/** Contador regressivo do show. Usa o relógio do sistema (não deriva com o tempo). */
@Injectable({ providedIn: 'root' })
export class CountdownService implements OnDestroy {
  readonly remainingSec = signal(0);
  readonly running = signal(false);
  readonly finished = computed(() => !this.running() && this.remainingSec() === 0 && this.hasRun());
  private readonly hasRun = signal(false);

  private endAt = 0;
  private tick: Subscription | null = null;

  setMinutes(minutes: number): void {
    this.stop();
    this.remainingSec.set(Math.max(0, Math.round(minutes * 60)));
    this.hasRun.set(false);
  }

  start(): void {
    if (this.running() || this.remainingSec() <= 0) return;
    this.endAt = Date.now() + this.remainingSec() * 1000;
    this.running.set(true);
    this.hasRun.set(true);
    this.tick = interval(250).subscribe(() => {
      const left = Math.max(0, Math.ceil((this.endAt - Date.now()) / 1000));
      this.remainingSec.set(left);
      if (left === 0) this.stop();
    });
  }

  pause(): void {
    this.stop();
  }

  reset(): void {
    this.stop();
    this.remainingSec.set(0);
    this.hasRun.set(false);
  }

  private stop(): void {
    this.tick?.unsubscribe();
    this.tick = null;
    this.running.set(false);
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
