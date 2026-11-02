import { NgZone } from '@angular/core';
import { Observable } from 'rxjs';
import { listen } from '@tauri-apps/api/event';

/**
 * Converte um evento Tauri em Observable.
 * Os callbacks do Tauri chegam fora da NgZone; sem zone.run a tela não atualiza.
 * O unlisten garante que não há vazamento ao cancelar a inscrição.
 */
export function fromTauriEvent<T>(name: string, zone: NgZone): Observable<T> {
  return new Observable<T>((subscriber) => {
    let unlisten: (() => void) | undefined;
    let closed = false;
    listen<T>(name, (e) => zone.run(() => subscriber.next(e.payload))).then((un) => {
      if (closed) un();
      else unlisten = un;
    });
    return () => {
      closed = true;
      unlisten?.();
    };
  });
}
