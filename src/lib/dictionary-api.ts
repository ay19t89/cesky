import type { Lookup } from './types';

export type DictionaryResponse = Lookup & {
  suggestions?: string[];
  error?: string;
  message?: string;
};

const dictionaryEndpoint =
  import.meta.env.VITE_DICTIONARY_API || '/api/dictionary';
const lookupIntervalMs = 4_000;
let nextLookupAt = 0;
let lookupQueue = Promise.resolve();

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolveWait, reject) => {
    const timer = setTimeout(resolveWait, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      },
      { once: true }
    );
  });
}

function scheduleLookup<T>(
  task: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  const scheduled = lookupQueue.then(async () => {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    await wait(Math.max(0, nextLookupAt - Date.now()), signal);
    nextLookupAt = Date.now() + lookupIntervalMs;
    return await task();
  });
  lookupQueue = scheduled.then(
    () => undefined,
    () => undefined
  );
  return scheduled;
}

async function fetchDictionary(
  query: URLSearchParams,
  signal?: AbortSignal
): Promise<DictionaryResponse> {
  const response = await fetch(`${dictionaryEndpoint}?${query}`, { signal });
  const data = (await response.json().catch(() => ({
    error: 'Služba není dostupná. Zkuste to prosím znovu.'
  }))) as DictionaryResponse;

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Ověření se nezdařilo.');
  }

  return data;
}

export async function requestDictionary(
  word: string,
  action: 'lookup' | 'suggest' = 'lookup',
  signal?: AbortSignal
): Promise<DictionaryResponse> {
  const query = new URLSearchParams({ word, action });
  const request = () => fetchDictionary(query, signal);
  return action === 'lookup' ? scheduleLookup(request, signal) : request();
}
