<script lang="ts">
  import Icon from '$lib/Icon.svelte';
  import { ijpUrlForWord } from '$lib/ijp-url';
  import type { Lookup, Source } from '$lib/types';

  let { result }: { result: Lookup } = $props();

  function sourceStatusLabel(status: Source['status']): string {
    if (status === 'ok') return 'Načteno';
    if (status === 'error') return 'Nedostupné';
    return 'Nenalezeno';
  }
</script>

<div class="mx-7 mb-5 max-[700px]:mx-4 max-[700px]:mb-4">
  <div
    class="flex min-h-12 flex-wrap items-center gap-2 rounded-lg border border-[#e0e7f0] px-3 py-2 text-sm"
  >
    <span
      class="size-2 rounded-full {result.ijp.status === 'ok'
        ? 'bg-[#248568]'
        : 'bg-[#b58233]'}"
    ></span>
    <a
      class="inline-flex items-center gap-1 text-blue-900 hover:text-blue-700 no-underline"
      href={result.ijp.entries.length
        ? ijpUrlForWord(result.word)
        : result.ijp.url}
      target="_blank"
      rel="noreferrer"
    >
      Internetová jazyková příručka
      <Icon name="arrow-right-up-line" />
    </a>
    {#if result.ijp.message}
      <span
        class="rounded-md bg-[#fff8e7] px-2 py-2 text-xs leading-snug text-[#795d21]"
      >
        {result.ijp.message}
      </span>
    {/if}
    <small class="ml-auto text-xs text-[#61738a]">
      {sourceStatusLabel(result.ijp.status)}
    </small>
  </div>
</div>
