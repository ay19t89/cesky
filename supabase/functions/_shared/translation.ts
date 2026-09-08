import type { TranslationLanguage } from './types.ts';

export function translationUrl(
  language: TranslationLanguage,
  word: string
): string {
  const canonicalWord = word.trim().normalize('NFC');
  return `https://slovnik.seznam.cz/preklad/cesky_${language}/${encodeURIComponent(canonicalWord)}`;
}
