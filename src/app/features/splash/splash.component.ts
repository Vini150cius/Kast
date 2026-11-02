import { Component, OnDestroy, OnInit, signal } from '@angular/core';

const STEPS = [
  'Iniciando o motor de áudio',
  'Mapeando monitores',
  'Preparando as janelas de exibição',
  'Quase pronto'
];

@Component({
  selector: 'app-splash',
  standalone: true,
  template: `
    <main class="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-[#040408]">
      <div class="glow absolute left-1/2 top-[44%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"></div>

      <img src="assets/kast-logo.png" alt="Kast" class="logo relative w-[460px] select-none" draggable="false" />

      <div class="status absolute bottom-9 w-[300px]">
        <div class="h-[3px] overflow-hidden rounded-full bg-white/10">
          <div class="bar h-full rounded-full bg-gradient-to-r from-violet-700 via-violet-500 to-violet-300"></div>
        </div>
        <p class="mt-3 flex justify-between text-[11px] text-violet-200/60">
          <span aria-live="polite">{{ step() }}…</span>
          <span class="font-mono">v1.0.0</span>
        </p>
      </div>
    </main>
  `,
  styles: [`
    .glow { background: radial-gradient(closest-side, rgba(124,58,237,.38), rgba(124,58,237,0)); animation: breathe 3.2s ease-in-out infinite; }
    /* A arte tem fundo quase preto: a máscara dissolve as bordas para fundir com a janela. */
    .logo {
      mix-blend-mode: screen;
      -webkit-mask-image: linear-gradient(to right, transparent, #000 5%, #000 95%, transparent), linear-gradient(to bottom, transparent, #000 18%, #000 82%, transparent);
      -webkit-mask-composite: source-in;
      mask-image: linear-gradient(to right, transparent, #000 5%, #000 95%, transparent), linear-gradient(to bottom, transparent, #000 18%, #000 82%, transparent);
      mask-composite: intersect;
      animation: emblem-in 1.1s cubic-bezier(.2,.8,.2,1) both;
    }
    .status { animation: fade-up .8s 1.1s both; }
    .bar { width: 0; animation: load 3.3s .3s cubic-bezier(.4,0,.2,1) forwards; }
    @keyframes emblem-in { from { opacity: 0; transform: scale(.82); filter: blur(8px); } to { opacity: 1; transform: scale(1); filter: blur(0); } }
    @keyframes fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    @keyframes load { 0% { width: 0; } 55% { width: 62%; } 85% { width: 90%; } 100% { width: 100%; } }
    @keyframes breathe { 0%, 100% { opacity: .75; transform: translate(-50%, -50%) scale(.96); } 50% { opacity: 1; transform: translate(-50%, -50%) scale(1.06); } }
  `]
})
export class SplashComponent implements OnInit, OnDestroy {
  protected readonly step = signal(STEPS[0]);
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    let i = 0;
    this.timer = setInterval(() => {
      i = Math.min(i + 1, STEPS.length - 1);
      this.step.set(STEPS[i]);
    }, 900);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
