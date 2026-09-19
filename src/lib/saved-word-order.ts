import { compareCzechWords } from './czech-order';
import type { Saved } from './types';

export type SavedWordOrder = 'recent' | 'alphabetical';

export function sortSavedWords(
  rows: Saved[],
  order: SavedWordOrder
): Saved[] {
  return [...rows].sort((left, right) => {
    if (order === 'alphabetical') {
      return compareCzechWords(left.word, right.word);
    }
    return Date.parse(right.updated_at) - Date.parse(left.updated_at);
  });
}

export function findLatestSavedId(rows: Saved[]): string | undefined {
  return rows.reduce<Saved | undefined>((latest, row) => {
    if (!latest) return row;
    return Date.parse(row.updated_at) > Date.parse(latest.updated_at)
      ? row
      : latest;
  }, undefined)?.id;
}
