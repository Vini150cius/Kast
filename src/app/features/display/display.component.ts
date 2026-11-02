import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { DisplayPort } from '../../core/ports/display.port';
import { DisplayCommand } from '../../core/models/display.model';

type ShowCommand = Extract<DisplayCommand, { type: 'show' }>;

/**
 * Janela exibidora. Cada mídia vira um elemento novo sobreposto ao atual
 * (transição sem "piscar" em preto). O elemento antigo é descartado de verdade
 * (src removido + load()) para liberar o decoder e evitar vazamento de memória.
 */
@Component({
  selector: 'app-display',
  standalone: true,
  template: `
    <div #stage class="fixed inset-0 overflow-hidden bg-black" style="cursor: none">
      <div #cover class="pointer-events-none absolute inset-0 bg-black" style="opacity: 0; z-index: 2147483000"></div>
    </div>
  `
})
export class DisplayComponent implements OnInit, OnDestroy {
  @ViewChild('stage', { static: true }) private stage!: ElementRef<HTMLDivElement>;
  @ViewChild('cover', { static: true }) private cover!: ElementRef<HTMLDivElement>;

  private readonly display = inject(DisplayPort);
  private readonly route = inject(ActivatedRoute);
  private readonly sub = new Subscription();

  private label = 'display';
  private current: HTMLElement | null = null;
  private currentPlayId = 0;
  private token = 0;
  private z = 1;
  private frozen = false;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private disposeTimers = new Set<ReturnType<typeof setTimeout>>();

  ngOnInit(): void {
    this.label = `display-${this.route.snapshot.paramMap.get('id') ?? '0'}`;
    this.sub.add(
      this.display.commands$().subscribe((cmd) => {
        switch (cmd.type) {
          case 'show':
            void this.show(cmd);
            break;
          case 'clear':
            this.clear(cmd.transitionMs);
            break;
          case 'freeze':
            this.setFrozen(cmd.frozen);
            break;
          case 'blackout':
            this.setBlackout(cmd.on, cmd.transitionMs);
            break;
          case 'seek':
            if (this.current instanceof HTMLVideoElement) this.current.currentTime = cmd.positionMs / 1000;
            break;
        }
      })
    );
    // Progresso do vídeo para a barra do controlador (a cada 500 ms, só se houver vídeo).
    this.progressTimer = setInterval(() => {
      const el = this.current;
      if (el instanceof HTMLVideoElement && !el.paused) {
        void this.display.notifyProgress({
          playId: this.currentPlayId,
          positionMs: Math.round(el.currentTime * 1000),
          durationMs: isFinite(el.duration) ? Math.round(el.duration * 1000) : null,
          label: this.label
        });
      }
    }, 500);
    // Avisa o controlador para reenviar a cena atual (janela aberta no meio do evento).
    void this.display.notifyReady(this.label);
  }

  private async show(cmd: ShowCommand): Promise<void> {
    const myToken = ++this.token;
    const url = this.display.toAssetUrl(cmd.path);
    const el = cmd.kind === 'video' ? this.buildVideo(url, cmd) : this.buildImage(url);
    const ms = cmd.style === 'cut' ? 0 : cmd.transitionMs;

    el.style.cssText += `position:absolute;inset:0;width:100%;height:100%;object-fit:contain;` +
      `opacity:0;transition:opacity ${ms}ms ease-in-out;z-index:${++this.z};`;
    this.stage.nativeElement.appendChild(el);

    try {
      await this.whenReady(el);
    } catch {
      this.dispose(el);
      return;
    }
    // Chegou comando mais novo enquanto carregava: este já não interessa.
    if (myToken !== this.token) {
      this.dispose(el);
      return;
    }

    const old = this.current;
    this.current = el;
    this.currentPlayId = cmd.playId;
    if (el instanceof HTMLVideoElement && !this.frozen) void el.play().catch(() => undefined);
    requestAnimationFrame(() => (el.style.opacity = '1'));

    if (old) {
      if (cmd.style === 'dissolve') {
        old.style.transition = `opacity ${ms}ms ease-in-out`;
        old.style.opacity = '0';
      }
      this.disposeLater(old, ms);
    }
  }

  private clear(transitionMs: number): void {
    this.token++;
    const old = this.current;
    this.current = null;
    if (old) {
      old.style.transition = `opacity ${transitionMs}ms ease-in-out`;
      old.style.opacity = '0';
      this.disposeLater(old, transitionMs);
    }
  }

  private setFrozen(frozen: boolean): void {
    this.frozen = frozen;
    const el = this.current;
    if (el instanceof HTMLVideoElement) {
      if (frozen) el.pause();
      else void el.play().catch(() => undefined);
    }
  }

  private setBlackout(on: boolean, ms: number): void {
    const c = this.cover.nativeElement;
    c.style.transition = `opacity ${ms}ms ease-in-out`;
    c.style.opacity = on ? '1' : '0';
  }

  private buildVideo(url: string, cmd: ShowCommand): HTMLVideoElement {
    const v = document.createElement('video');
    v.muted = true; // todo o som sai pelo motor de áudio do Rust
    v.playsInline = true;
    v.preload = 'auto';
    v.loop = cmd.loopPlayback;
    v.disablePictureInPicture = true;
    v.addEventListener('ended', () => void this.display.notifyEnded(cmd.playId, this.label));
    v.src = url;
    return v;
  }

  private buildImage(url: string): HTMLImageElement {
    const img = document.createElement('img');
    img.decoding = 'async';
    img.draggable = false;
    img.src = url;
    return img;
  }

  private whenReady(el: HTMLElement): Promise<void> {
    return new Promise((resolve, reject) => {
      if (el instanceof HTMLVideoElement) {
        el.addEventListener('loadeddata', () => resolve(), { once: true });
        el.addEventListener('error', () => reject(el.error), { once: true });
      } else if (el instanceof HTMLImageElement) {
        el.addEventListener('load', () => resolve(), { once: true });
        el.addEventListener('error', () => reject(new Error('imagem inválida')), { once: true });
      }
    });
  }

  private disposeLater(el: HTMLElement, ms: number): void {
    const t = setTimeout(() => {
      this.disposeTimers.delete(t);
      this.dispose(el);
    }, ms + 60);
    this.disposeTimers.add(t);
  }

  private dispose(el: HTMLElement): void {
    if (el instanceof HTMLVideoElement) {
      el.pause();
      el.removeAttribute('src');
      el.load(); // solta o decoder e o buffer do arquivo grande
    } else if (el instanceof HTMLImageElement) {
      el.removeAttribute('src');
    }
    el.remove();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.progressTimer) clearInterval(this.progressTimer);
    this.disposeTimers.forEach(clearTimeout);
    if (this.current) this.dispose(this.current);
  }
}
