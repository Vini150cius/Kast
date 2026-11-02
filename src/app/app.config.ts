import { ApplicationConfig } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';
import { WindowingPort } from './core/ports/windowing.port';
import { MediaFsPort } from './core/ports/media-fs.port';
import { AudioPort } from './core/ports/audio.port';
import { DisplayPort } from './core/ports/display.port';
import { TauriWindowingAdapter } from './core/adapters/tauri-windowing.adapter';
import { TauriMediaFsAdapter } from './core/adapters/tauri-media-fs.adapter';
import { TauriAudioAdapter } from './core/adapters/tauri-audio.adapter';
import { TauriDisplayAdapter } from './core/adapters/tauri-display.adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    // Hash routing: funciona igual no dev server e no protocolo tauri://
    provideRouter(routes, withHashLocation()),
    // Inversão de dependência: services dependem dos Ports, não do Tauri.
    { provide: WindowingPort, useClass: TauriWindowingAdapter },
    { provide: MediaFsPort, useClass: TauriMediaFsAdapter },
    { provide: AudioPort, useClass: TauriAudioAdapter },
    { provide: DisplayPort, useClass: TauriDisplayAdapter }
  ]
};
