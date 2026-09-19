<script lang="ts">
  import DeclensionPatternBadges from '$lib/components/DeclensionPatternBadges.svelte';
  import DeclensionTable from '$lib/components/DeclensionTable.svelte';
  import DictionarySource from '$lib/components/DictionarySource.svelte';
  import { checkedAt } from '$lib/dictionary-format';
  import Icon from '$lib/Icon.svelte';
  import { genders, type Lookup } from '$lib/types';

  let {
    result,
    busy,
    saving,
    signedIn,
    currentSaved,
    message,
    onToggleSaved,
    onSuggestion
  }: {
    result: Lookup;
    busy: boolean;
    saving: boolean;
    signedIn: boolean;
    currentSaved: boolean;
    message: string;
    onToggleSaved: () => void;
    onSuggestion: (word: string) => void;
  } = $props();

  const resultGenders = $derived([
    ...new Set(result.ijp.entries.map((entry) => entry.gender))
  ]);
</script>

<section class="panel mt-6 overflow-hidden" aria-busy={busy}>
  <div
    class="flex justify-between gap-4 p-6 max-sm:flex-wrap max-sm:px-4 max-sm:pt-5"
  >
    <div>
      <div class="eyebrow">VÝSLEDEK OVĚŘENÍ</div>
      <h2 class="my-3 text-4xl tracking-[-1px]">
        {result.word}
      </h2>
      <div class="flex flex-wrap gap-2">
        {#each resultGenders as entryGender (entryGender ?? 'unknown')}
          <span
            class="rounded-md border border-[#d7e5ff] bg-[#edf3ff] px-2 py-1 text-[13px] text-[#4268bd]"
          >
            {entryGender ? genders[entryGender] : 'Rod neurčen'}
          </span>
        {/each}
        <DeclensionPatternBadges entries={result.ijp.entries} />
      </div>
      {#if result.requested !== result.word}
        <p class="max-w-162 text-sm text-[#52647c]">
          Příručka opravila „{result.requested}“ na „{result.word}“.
        </p>
      {/if}
    </div>
    <div
      class="flex flex-col absolute right-3 items-end justify-center gap-2"
    >
      <small class="text-xs text-neutral-500 tabular-nums">
        {checkedAt(result.checkedAt)}</small
      >
      <button
        class="btn"
        type="button"
        disabled={saving || busy || !signedIn || !result.ijp.entries.length}
        title={signedIn ? undefined : 'Pro ukládání slov se přihlaste.'}
        onclick={onToggleSaved}
      >
        <Icon name={currentSaved ? 'bookmark-fill' : 'bookmark-line'} />
        {saving ? 'Ukládám…' : currentSaved ? 'Uloženo' : 'Uložit slovo'}
      </button>
      {#if message}
        <small class="inline-flex items-center gap-1 text-xs text-[#287158]">
          <Icon name="check-line" />
          {message}
        </small>
      {/if}
    </div>
  </div>

  <DictionarySource {result} {onSuggestion} />
  <DeclensionTable {result} />
</section>
