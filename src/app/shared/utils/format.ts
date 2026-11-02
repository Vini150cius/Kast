export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return [h, m, s % 60].map((n) => n.toString().padStart(2, '0')).join(':');
}

export function resolutionLabel(w?: number, h?: number): string | null {
  if (!w || !h) return null;
  const long = Math.max(w, h);
  if (long >= 3840) return '4K';
  if (long >= 2560) return '2K';
  if (long >= 1920) return 'FHD';
  if (long >= 1280) return 'HD';
  return null;
}

export function volumeToDb(volume: number): string {
  if (volume <= 0.0001) return '-∞ dB';
  return `${(20 * Math.log10(volume)).toFixed(1)} dB`;
}
