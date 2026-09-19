export const TRANSLATION_LANGUAGES = ['anglicky', 'rusky'] as const;
export type TranslationLanguage = (typeof TRANSLATION_LANGUAGES)[number];

export function translationUrl(
  language: TranslationLanguage,
  word: string
): string {
  const canonicalWord = word.trim().normalize('NFC');
  return `https://slovnik.seznam.cz/preklad/cesky_${language}/${encodeURIComponent(canonicalWord)}`;
}
