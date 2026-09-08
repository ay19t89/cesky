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
    onSubmit: () => void;
  } = $props();

  let suggestionsOpen = $state(false);
</script>

<section class="panel p-6 shadow-[0_6px_20px_#152e5510] max-[700px]:p-[17px]">
  <label class="mb-2.5 block text-sm font-bold" for="word"
    >Které slovo chcete skloňovat?</label
  >
  <form
    class="flex items-center gap-3.5 max-[700px]:flex-wrap"
    onsubmit={(event) => {
      event.preventDefault();
      onSubmit();
    }}
  >
    <span class="max-[700px]:hidden"><Icon name="search" size={25} /></span>
    <div class="relative min-w-[100px] flex-1">
      <input
        class="w-full rounded-[7px] border-0 bg-white px-2 py-[11px] text-xl text-[#182c47]"
        id="word"
        bind:value={word}
        onfocus={() => (suggestionsOpen = true)}
        oninput={() => {
          suggestionsOpen = true;
          onInput();
        }}
        onblur={() => setTimeout(() => (suggestionsOpen = false), 120)}
        maxlength="80"
        autocomplete="off"
        placeholder="Například kamarád, žena nebo město"
        aria-autocomplete="list"
        aria-controls="word-suggestions"
        aria-expanded={suggestionsOpen && suggestions.length > 0}
      />
      {#if suggestionsOpen && suggestions.length}
        <div
          id="word-suggestions"
          role="listbox"
          class="absolute top-full right-0 left-0 z-30 mt-2 overflow-hidden rounded-lg border border-[#dbe3ee] bg-white p-1.5 shadow-[0_12px_32px_rgba(23,55,95,0.16)]"
        >
          {#each suggestions as suggestion}
            <button
              class="block w-full cursor-pointer rounded-md bg-transparent px-3 py-2 text-left text-[15px] text-[#24415f] hover:bg-[#edf3ff]"
              type="button"
              role="option"
              aria-selected={word === suggestion}
              onclick={() => {
                word = suggestion;
                suggestionsOpen = false;
              }}>{suggestion}</button
            >
          {/each}
        </div>
      {/if}
    </div>
    <button
      class="btn max-[700px]:w-full"
      type="submit"
      disabled={busy || !word.trim()}
    >
      {#if busy}<Icon name="loader" /> Ověřuji…{:else}Ověřit slovo <Icon
          name="arrow-right"
        />{/if}
    </button>
  </form>
  <small class="mt-3 block text-[13px] text-[#6a7a91]"
    >Návrhy běžných a uložených slov, i bez diakritiky. Po přihlášení také
    opravy podle příručky.</small
  >
</section>
