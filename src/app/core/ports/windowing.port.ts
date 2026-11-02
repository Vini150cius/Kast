import { MonitorInfo } from '../models/monitor.model';

export abstract class WindowingPort {
  abstract listMonitors(): Promise<MonitorInfo[]>;
  abstract openDisplays(): Promise<string[]>;
  abstract closeDisplays(): Promise<void>;
  abstract setFullscreen(fullscreen: boolean): Promise<void>;
  abstract appReady(): Promise<void>;
}
