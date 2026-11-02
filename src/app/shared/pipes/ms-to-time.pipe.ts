import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'msToTime', standalone: true })
export class MsToTimePipe implements PipeTransform {
  transform(ms: number | null | undefined): string {
    if (ms == null || !isFinite(ms)) return '--:--';
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}
