const UNITS: Array<{ ms: number; label: string }> = [
  { ms: 60 * 1000, label: 'minute' },
  { ms: 60 * 60 * 1000, label: 'hour' },
  { ms: 24 * 60 * 60 * 1000, label: 'day' },
  { ms: 7 * 24 * 60 * 60 * 1000, label: 'week' },
  { ms: 30 * 24 * 60 * 60 * 1000, label: 'month' },
  { ms: 365 * 24 * 60 * 60 * 1000, label: 'year' },
];

export function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 60 * 1000) return 'just now';
  for (let i = UNITS.length - 1; i >= 0; i--) {
    if (diff >= UNITS[i].ms) {
      const value = Math.floor(diff / UNITS[i].ms);
      return `${value} ${UNITS[i].label}${value === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
}
