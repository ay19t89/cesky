import { requestDictionary } from './dictionary-api';
import {
  loadLearnedSuggestions,
  rememberSuggestion,
  suggest
} from './suggestions';

type SuggestionControllerOptions = {
  getWord: () => string;
  getVocabulary?: () => string[];
  setSuggestions: (suggestions: string[]) => void;
};

export function createSuggestionController({
  getWord,
  getVocabulary = () => [],
  setSuggestions
}: SuggestionControllerOptions) {
  let learned = loadLearnedSuggestions();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let request: AbortController | undefined;

  function cancel(): void {
    if (timer) clearTimeout(timer);
    timer = undefined;
    request?.abort();
    request = undefined;
  }

  function update(): void {
    const value = getWord().trim();
    const local = suggest(value, [...getVocabulary(), ...learned]);
    setSuggestions(local);
    cancel();
    if (value.length < 3) return;

    timer = setTimeout(() => {
      const controller = new AbortController();
      request = controller;
      requestDictionary(value, 'suggest', controller.signal)
        .then((data) => {
          if (getWord().trim() !== value) return;
          const remote = data.suggestions || [];
          setSuggestions([...new Set([...remote, ...local])].slice(0, 8));
        })
        .catch((cause) => {
          if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
            setSuggestions(local);
          }
        });
    }, 4_000);
  }

  function remember(word: string): void {
    learned = rememberSuggestion(word);
  }

  return { cancel, remember, update };
}
