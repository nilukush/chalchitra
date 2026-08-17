/** "214 minutes" → "3h 34m"; ranges and garbage pass through sensibly. */
export function formatRuntime(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const range = /(\d{1,3})\s*[–—-]\s*(\d{1,3})/.exec(raw);
  if (range) {
    const [a, b] = [Number(range[1]), Number(range[2])];
    if (a >= 60) return `${Math.floor(a / 60)}h ${a % 60}m – ${Math.floor(b / 60)}h ${b % 60}m`;
    return `${a}–${b} min`;
  }
  const m = /(\d{1,3})/.exec(raw);
  if (!m) return raw;
  const mins = Number(m[1]);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}
