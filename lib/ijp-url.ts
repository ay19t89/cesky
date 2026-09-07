export const IJP_BASE_URL = 'https://prirucka.ujc.cas.cz/';

export function ijpUrlForWord(word: string): string {
  const canonicalWord = word.trim().normalize('NFC');
  return `${IJP_BASE_URL}?slovo=${encodeURIComponent(canonicalWord)}`;
}
