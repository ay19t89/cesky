import { pushState, replaceState } from '$app/navigation';
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

export function openSavedWord(word: string): void {
  const url = new URL(window.location.href);
  replaceState(resolve(currentPath(url)), { view: 'saved' });
  url.searchParams.set('slovo', word);
  pushState(resolve(currentPath(url)), { view: 'lookup', word });
}

export function isSavedDictionaryPath(): boolean {
  const path = new URL(window.location.href).pathname.replace(/\/$/, '');
  return path === `${base}/slovnik`;
}

export function openSavedDictionary(): void {
  const url = new URL(window.location.href);
  url.pathname = `${base}/slovnik`;
  url.search = '';
  if (isSavedDictionaryPath() && !getLookupWord()) {
    replaceState(resolve(currentPath(url)), { view: 'saved' });
    return;
  }
  pushState(resolve(currentPath(url)), { view: 'saved' });
}

export function openLookupHome(): void {
  const url = new URL(window.location.href);
  url.pathname = `${base}/`;
  url.search = '';
  pushState(resolve(currentPath(url)), { view: 'lookup' });
}
