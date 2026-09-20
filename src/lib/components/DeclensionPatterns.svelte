<script lang="ts">
  import CanonicalPatternTable from '$lib/components/CanonicalPatternTable.svelte';
  import { canonicalPatterns } from '$lib/declension-patterns';
  import Icon from '$lib/Icon.svelte';
  import { examplesByPattern, patternGroups } from '$lib/pattern-examples';
  import type { Saved } from '$lib/types';
  import { SvelteSet } from 'svelte/reactivity';

  let {
    saved,
    signedIn,
    busy,
    error,
    onLogin,
    onOpen,
    onRefresh
  }: {
    saved: Saved[];
    signedIn: boolean;
    busy: boolean;
    error: string;
    onLogin: () => void;
    onOpen: (word: string) => void;
    onRefresh: () => void;
  } = $props();

  const examples = $derived(examplesByPattern(saved));
  const canonicalByName = new Map(
    canonicalPatterns.map((pattern) => [pattern.name, pattern])
  );
  const visibleExamples = new SvelteSet<string>();

  function exampleLabel(count: number): string {
    if (count === 1) return '1 příklad';
    if (count > 1 && count < 5) return `${count} příklady`;
    return `${count} příkladů`;
  }

  function patternLabel(count: number): string {
    return count > 1 && count < 5 ? `${count} vzory` : `${count} vzorů`;
  }

  function toggleExamples(pattern: string): void {
    if (!signedIn) {
      onLogin();
      return;
    }

    if (visibleExamples.has(pattern)) visibleExamples.delete(pattern);
    else visibleExamples.add(pattern);
  }
</script>

<section class="panel mt-6 overflow-hidden">
  <div class="flex items-start justify-between gap-4 p-5 sm:p-6">
    <div>
      <div class="eyebrow">PŘEHLED VZORŮ</div>
      <h2 class="mt-2 text-2xl tracking-[-0.5px]">Skloňovací vzory</h2>
      <p class="mt-2 mb-0 max-w-2xl text-sm text-neutral-500">
        Rozbalte vzor pro jeho skloňování a případné příklady ze svého slovníku.
      </p>
    </div>
    {#if signedIn}
      <button
        class="btn btn-secondary size-12 shrink-0 p-0"
        type="button"
        aria-label="Obnovit příklady"
        disabled={busy}
        onclick={onRefresh}
      >
        <Icon name="refresh-line" />
      </button>
    {/if}
  </div>

  {#if error}
    <p class="notice notice-error mx-5 mt-0 sm:mx-6" role="alert">{error}</p>
  {/if}

  <div class="space-y-7 border-t border-[#e5ebf3] p-5 sm:p-6">
    {#each patternGroups as group (group.title)}
      <section>
        <div class="mb-3 flex items-baseline justify-between gap-2">
          <h3 class="text-lg font-bold text-[#183452]">{group.title}</h3>
          <span class="text-xs font-semibold text-[#61738a]">
            {patternLabel(group.count)}
          </span>
        </div>

        <div class="grid gap-5 lg:grid-cols-2">
          {#each group.sections as section (`${group.title}-${section.title || 'all'}`)}
            <div>
              {#if section.title}
                <h4 class="mb-2 text-sm font-bold text-[#52647c]">
                  {section.title} · {section.patterns.length} vzory
                </h4>
              {/if}

              <div class="grid gap-3 xl:grid-cols-2">
                {#each section.patterns as pattern (pattern)}
                  {@const words = examples.get(pattern) || []}
                  {@const canonical = canonicalByName.get(pattern)}
                  <details
                    class="group rounded-lg border border-[#dbe3ee] bg-white"
                  >
                    <summary
                      class="flex cursor-pointer list-none items-center gap-3 px-3 py-3 [&::-webkit-details-marker]:hidden"
                    >
                      <span class="font-bold text-[#183452]">{pattern}</span>
                      <span class="ml-auto text-xs text-[#61738a]">
                        Tabulka skloňování
                      </span>
                      <span class="transition-transform group-open:rotate-180">
                        <Icon name="arrow-down-s-line" />
                      </span>
                    </summary>

                    <div class="border-t border-[#e5ebf3]">
                      {#if canonical}
                        <CanonicalPatternTable pattern={canonical} />
                      {/if}

                      <div class="border-t border-[#e5ebf3] p-3">
                        <button
                          class="btn btn-secondary px-3 py-2 text-xs"
                          type="button"
                          disabled={signedIn && busy}
                          onclick={() => toggleExamples(pattern)}
                        >
                          <Icon name="database-2-line" />
                          {signedIn
                            ? `Příklady z mého slovníku · ${exampleLabel(words.length)}`
                            : 'Příklady z mého slovníku'}
                        </button>

                        {#if visibleExamples.has(pattern)}
                          <div class="mt-3">
                            {#if words.length}
                              <div class="flex flex-wrap gap-2">
                                {#each words as word (word)}
                                  <button
                                    class="inline-flex cursor-pointer items-center gap-1 rounded-md bg-[#edf3ff] px-2 py-1 text-sm font-semibold text-[#4268bd] hover:bg-[#e1ebff]"
                                    type="button"
                                    onclick={() => onOpen(word)}
                                  >
                                    {word}
                                    <Icon name="arrow-right-up-line" />
                                  </button>
                                {/each}
                              </div>
                            {:else}
                              <p class="text-sm text-[#61738a]">
                                Ve vašem slovníku zatím není žádný příklad.
                              </p>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    </div>
                  </details>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</section>
