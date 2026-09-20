<script lang="ts">
  import Icon from '$lib/Icon.svelte';

  let {
    word = $bindable(),
    suggestions,
    busy,
    onInput,
    onSubmit
  }: {
    word: string;
    suggestions: string[];
    busy: boolean;
    onInput: () => void;
    onSubmit: (searchWord: string) => void;
  } = $props();

  let suggestionsOpen = $state(false);
  let activeSuggestionIndex = $state(-1);

  function closeSuggestions(): void {
    suggestionsOpen = false;
    activeSuggestionIndex = -1;
  }

  function selectSuggestion(suggestion: string): void {
    word = suggestion;
    closeSuggestions();
    onSubmit(suggestion);
  }

  function moveActiveSuggestion(direction: 1 | -1): void {
    if (!suggestions.length) return;
    suggestionsOpen = true;
    activeSuggestionIndex =
      (activeSuggestionIndex + direction + suggestions.length) %
      suggestions.length;
  }

  function handleSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveActiveSuggestion(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }

    if (event.key === 'Escape') {
      closeSuggestions();
      return;
    }

    const activeSuggestion = suggestions[activeSuggestionIndex];
    if (event.key === 'Enter' && suggestionsOpen && activeSuggestion) {
      event.preventDefault();
      selectSuggestion(activeSuggestion);
    }
  }
</script>

<section class="panel p-4 sm:p-6 shadow-[0_6px_20px_#152e5510]">
  <label class="mb-2 block text-sm font-bold" for="word"
    >Které slovo chcete skloňovat?</label
  >
  <form
    class="flex items-center gap-4 max-sm:flex-wrap"
    onsubmit={(event) => {
      event.preventDefault();
      closeSuggestions();
      onSubmit(word);
    }}
  >
    <span class="max-sm:hidden">
      <Icon name="search-line" />
    </span>
    <div class="relative min-w-24 flex-1">
      <input
        class={[
          'w-full rounded-lg border border-slate-300 bg-white p-3',
          'text-xl text-blue-950 outline-offset-0',
          'focus:border-blue-200 focus:outline-2 focus:outline-blue-200'
        ]}
        id="word"
        bind:value={word}
        onfocus={() => {
          suggestionsOpen = true;
          activeSuggestionIndex = -1;
        }}
        oninput={() => {
          suggestionsOpen = true;
          activeSuggestionIndex = -1;
          onInput();
        }}
        onkeydown={handleSearchKeydown}
        onblur={() => setTimeout(closeSuggestions, 120)}
        maxlength="80"
        autocomplete="off"
        enterkeyhint="search"
        placeholder="Například kamarád, žena nebo město"
        aria-autocomplete="list"
        aria-controls="word-suggestions"
        aria-activedescendant={activeSuggestionIndex >= 0
          ? `word-suggestion-${activeSuggestionIndex}`
          : undefined}
        aria-expanded={suggestionsOpen && suggestions.length > 0}
      />
      {#if suggestionsOpen && suggestions.length}
        <div
          id="word-suggestions"
          role="listbox"
          class={[
            'absolute top-full right-0 left-0 z-30 mt-2 overflow-hidden',
            'rounded-lg border border-[#dbe3ee] bg-white p-2',
            'shadow-[0_12px_32px_rgba(23,55,95,0.16)]'
          ]}
        >
          {#each suggestions as suggestion, index (suggestion)}
            <button
              class={[
                'block w-full cursor-pointer rounded-md bg-transparent px-3',
                'py-2 text-left text-[15px] text-[#24415f]',
                'hover:bg-[#edf3ff]',
                activeSuggestionIndex === index && 'bg-[#edf3ff]'
              ]}
              id={`word-suggestion-${index}`}
              type="button"
              role="option"
              aria-selected={activeSuggestionIndex === index}
              onfocus={() => (activeSuggestionIndex = index)}
              onclick={() => selectSuggestion(suggestion)}
              disabled={busy}>{suggestion}</button
            >
          {/each}
        </div>
      {/if}
    </div>
    <button
      class="btn max-sm:w-full"
      type="submit"
      disabled={busy || !word.trim()}
    >
      {#if busy}
        <span class="[&>i]:animate-spin"><Icon name="loader-4-line" /></span>
        Ověřuji…
      {:else}
        Ověřit slovo <Icon name="arrow-right-line" />
      {/if}
    </button>
  </form>
  <small class="mt-3 block text-[13px] text-neutral-500"
    >Návrhy běžných a uložených slov, i bez diakritiky. Přihlášení je potřeba
    jen pro osobní slovník.</small
  >
</section>
