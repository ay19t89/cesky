import { cases, type Lookup } from '../types';
import { ijpUrlForWord } from '../ijp-url';
import { translationUrl } from '../translation';
import { entriesForExport, genderLabel } from './shared';

export function exportRows(results: Lookup[]): string[][] {
  return entriesForExport(results).flatMap(({ result, entry }) => {
    const word = entry?.lemma || result.word;
    const sourceLink = ijpUrlForWord(word);

    return (['singular', 'plural'] as const).map((number) => [
      genderLabel(entry),
      word,
      number === 'singular' ? 'Jednotné' : 'Množné',
      ...cases.map((_, index) => entry?.[number][index].join(', ') || '—'),
      translationUrl(number === 'singular' ? 'anglicky' : 'rusky', word),
      sourceLink
    ]);
  });
}
