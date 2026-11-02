import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { WindowingPort } from '../ports/windowing.port';
import { MonitorInfo } from '../models/monitor.model';

@Injectable()
export class TauriWindowingAdapter extends WindowingPort {
  listMonitors(): Promise<MonitorInfo[]> {
    return invoke<MonitorInfo[]>('list_monitors');
  }
  openDisplays(): Promise<string[]> {
    return invoke<string[]>('open_display_windows');
  }
  closeDisplays(): Promise<void> {
    return invoke<void>('close_display_windows');
  }
  setFullscreen(fullscreen: boolean): Promise<void> {
    return invoke<void>('set_displays_fullscreen', { fullscreen });
  }
  appReady(): Promise<void> {
    return invoke<void>('app_ready');
  }
}
