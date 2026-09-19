<script lang="ts">
  import {
    inferDeclensionPatterns,
    type DeclensionPatternMatch
  } from '$lib/declension-patterns';
  import type { Paradigm } from '$lib/types';

  let { entries }: { entries: Paradigm[] } = $props();

  const matches = $derived.by(() => {
    const inferred = entries
      .flatMap((entry) => inferDeclensionPatterns(entry, 2))
      .filter((match): match is DeclensionPatternMatch => Boolean(match))
      .sort((left, right) => right.score - left.score);

    return inferred.filter(
      (match, index) =>
        inferred.findIndex((candidate) => candidate.name === match.name) ===
        index
    );
  });

  function confidentLabel(match: DeclensionPatternMatch): string {
    if (match.confidence === 'high') return `Vzor: ${match.name}`;
    return `Pravděpodobný vzor: ${match.name}`;
  }

  const uncertain = $derived(matches[0]?.confidence === 'low');
  const title = $derived(
    matches
      .map(
        (match) =>
          `${match.name}: ${match.score} % z ${match.comparedForms} porovnaných tvarů`
      )
      .join('; ')
  );
</script>

{#if uncertain}
  <span
    class="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[13px]
      text-emerald-800"
    {title}
  >
    Možný vzor: {matches.map((match) => match.name).join(', ')}
  </span>
{:else if matches[0]}
  <span
    class="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[13px]
      text-emerald-800"
    {title}
  >
    {confidentLabel(matches[0])}
  </span>
{/if}
