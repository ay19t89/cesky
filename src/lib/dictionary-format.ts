import type { Source } from './types';

export function formText(
  source: Source,
  number: 'singular' | 'plural',
  index: number
): string {
  if (!source.entries.length) return '—';
  return source.entries
    .map((entry) => entry[number][index]?.join(', ') || '—')
    .join(' · ');
}

export function checkedAt(value: string): string {
  return new Date(value).toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}
