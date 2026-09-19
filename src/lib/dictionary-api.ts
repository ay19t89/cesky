import type { Lookup } from './types';

export type DictionaryResponse = Lookup & {
  suggestions?: string[];
  error?: string;
  message?: string;
};

const dictionaryEndpoint =
  import.meta.env.VITE_DICTIONARY_API || '/api/dictionary';

export async function requestDictionary(
  word: string,
  action: 'lookup' | 'suggest' = 'lookup',
  signal?: AbortSignal
): Promise<DictionaryResponse> {
  const query = new URLSearchParams({ word, action });
  const response = await fetch(`${dictionaryEndpoint}?${query}`, {
    signal
  });
  const data = (await response.json().catch(() => ({
    error: 'Služba není dostupná. Zkuste to prosím znovu.'
  }))) as DictionaryResponse;

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Ověření se nezdařilo.');
  }

  return data;
}
