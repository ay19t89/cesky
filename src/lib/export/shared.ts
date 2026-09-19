import { genders, type Lookup, type Paradigm } from '../types';
import { compareCzechWords } from '../czech-order';

export { compareCzechWords };

export const headers = [
  'Rod',
  'Slovo',
  'Číslo',
  '1. pád',
  '2. pád',
  '3. pád',
  '4. pád',
  '5. pád',
  '6. pád',
  '7. pád',
  'Překlad',
  'Odkaz'
];

export type ExportEntry = {
  result: Lookup;
  entry: Paradigm | null;
};

export function entriesForExport(results: Lookup[]): ExportEntry[] {
  return results
    .flatMap((result) => {
      const entries = result.ijp.entries.length ? result.ijp.entries : [null];
      return entries.map((entry) => ({ result, entry }));
    })
    .sort((left, right) =>
      compareCzechWords(
        left.entry?.lemma || left.result.word,
        right.entry?.lemma || right.result.word
      )
    );
}

export function genderLabel(entry: Paradigm | null): string {
  return entry?.gender ? genders[entry.gender] : 'Rod neurčen';
}


export function datedExportFilename(word: string, date = new Date()): string {
  return `${word}_${date.toISOString().slice(0, 10)}`;
}

export function download(data: BlobPart, type: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
