<script lang="ts">
  import {
    inferDeclensionPattern,
    type DeclensionPatternMatch
  } from '$lib/declension-patterns';
  import type { Paradigm } from '$lib/types';

  let { entries }: { entries: Paradigm[] } = $props();

  const matches = $derived.by(() => {
    const inferred = entries
      .map(inferDeclensionPattern)
      .filter((match): match is DeclensionPatternMatch => Boolean(match))
      .sort((left, right) => right.score - left.score);

    return inferred.filter(
      (match, index) =>
        inferred.findIndex((candidate) => candidate.name === match.name) ===
        index
    );
  });

  function label(match: DeclensionPatternMatch): string {
    if (match.confidence === 'high') return `Vzor: ${match.name}`;
    if (match.confidence === 'medium')
      return `Pravděpodobný vzor: ${match.name}`;
    return `Možný vzor: ${match.name}`;
  }
</script>

{#each matches as match (match.name)}
  <span
    class="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[13px]
      text-emerald-800"
    title={`Shoda s kanonickým vzorem: ${match.score} % z ${match.comparedForms} porovnaných tvarů.`}
  >
    {label(match)}
  </span>
{/each}
