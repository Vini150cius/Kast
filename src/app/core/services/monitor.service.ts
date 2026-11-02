import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WindowingPort } from '../ports/windowing.port';
import { MonitorInfo } from '../models/monitor.model';

@Injectable({ providedIn: 'root' })
export class MonitorService {
  private readonly windowing = inject(WindowingPort);

  private readonly monitorsSubject = new BehaviorSubject<MonitorInfo[]>([]);
  private readonly displaysSubject = new BehaviorSubject<string[]>([]);
  private readonly errorSubject = new BehaviorSubject<string | null>(null);
  private readonly connectedSubject = new BehaviorSubject<boolean>(false);
  private readonly fullscreenSubject = new BehaviorSubject<boolean>(false);

  readonly monitors$ = this.monitorsSubject.asObservable();
  /** Labels das janelas exibidoras abertas. */
  readonly displays$ = this.displaysSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();
  /** True quando a última chamada ao back-end Rust funcionou. */
  readonly connected$ = this.connectedSubject.asObservable();
  readonly fullscreen$ = this.fullscreenSubject.asObservable();

  get displaysOpen(): boolean {
    return this.displaysSubject.value.length > 0;
  }

  async refresh(): Promise<void> {
    try {
      this.monitorsSubject.next(await this.windowing.listMonitors());
      this.errorSubject.next(null);
      this.connectedSubject.next(true);
    } catch (e) {
      this.errorSubject.next(String(e));
      this.connectedSubject.next(false);
    }
  }

  async openDisplays(): Promise<void> {
    try {
      this.displaysSubject.next(await this.windowing.openDisplays());
      this.errorSubject.next(null);
    } catch (e) {
      this.errorSubject.next(String(e));
    }
  }

  async closeDisplays(): Promise<void> {
    try {
      await this.windowing.closeDisplays();
      this.displaysSubject.next([]);
      this.fullscreenSubject.next(false);
    } catch (e) {
      this.errorSubject.next(String(e));
    }
  }

  async toggleDisplays(): Promise<void> {
    if (this.displaysOpen) await this.closeDisplays();
    else await this.openDisplays();
  }

  async toggleFullscreen(): Promise<void> {
    if (!this.displaysOpen) return;
    const next = !this.fullscreenSubject.value;
    try {
      await this.windowing.setFullscreen(next);
      this.fullscreenSubject.next(next);
    } catch (e) {
      this.errorSubject.next(String(e));
    }
  }

  /** Splash -> interface: avisa o back-end que o Angular terminou de carregar. */
  async notifyReady(): Promise<void> {
    await this.windowing.appReady();
  }
}
