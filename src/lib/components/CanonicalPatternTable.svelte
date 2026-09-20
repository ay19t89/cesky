<script lang="ts">
  import { caseNames, questions, type Paradigm } from '$lib/types';

  let { pattern }: { pattern: Paradigm } = $props();

  function forms(values: string[][], index: number): string {
    return values[index]?.join(', ') || '—';
  }
</script>

<div class="overflow-x-auto">
  <table class="data-table min-w-120 table-fixed text-sm">
    <colgroup>
      <col class="w-2/5" />
      <col class="w-3/10" />
      <col class="w-3/10" />
    </colgroup>
    <thead>
      <tr>
        <th>Pád a otázka</th>
        <th>Jednotné číslo</th>
        <th>Množné číslo</th>
      </tr>
    </thead>
    <tbody>
      {#each caseNames as caseName, index (caseName)}
        <tr>
          <td>
            <strong>{index + 1}. {caseName}</strong>
            <small class="mt-1 block text-xs text-neutral-500">
              {questions[index]}
            </small>
          </td>
          <td>{forms(pattern.singular, index)}</td>
          <td>{forms(pattern.plural, index)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
