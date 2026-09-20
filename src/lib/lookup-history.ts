import { goto, pushState } from '$app/navigation';
import { base, resolve } from '$app/paths';
import type { PathnameWithSearchOrHash } from '$app/types';

function currentPath(url: URL): PathnameWithSearchOrHash {
  return `${url.pathname}${url.search}` as PathnameWithSearchOrHash;
}

export function getLookupWord(): string | null {
  return new URL(window.location.href).searchParams.get('slovo');
}

export function pushLookupWord(word: string): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get('slovo') === word) return;
  url.searchParams.set('slovo', word);
  pushState(resolve(currentPath(url)), { view: 'lookup', word });
}

export function openSavedWord(word: string): Promise<void> {
  const query = new URLSearchParams({ slovo: word });
  return goto(`${base}/?${query}`);
}

export function openSavedDictionary(): Promise<void> {
  return goto(`${base}/slovnik`);
}

export function openPatterns(): Promise<void> {
  return goto(`${base}/vzory`);
}

export function openLookupHome(): Promise<void> {
  return goto(`${base}/`);
}
