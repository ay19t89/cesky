<script lang="ts">
  import Icon from '$lib/Icon.svelte';

  export type View = 'lookup' | 'saved';
  export type ExportFormat = 'csv' | 'xlsx' | 'pdf-a4' | 'pdf-a3';

  let {
    view,
    savedCount,
    exportDisabled,
    onView,
    onExport
  }: {
    view: View;
    savedCount: number;
    exportDisabled: boolean;
    onView: (view: View) => void;
    onExport: (format: ExportFormat) => void;
  } = $props();

  const options: [ExportFormat, string][] = [
    ['csv', 'CSV'],
    ['xlsx', 'XLSX'],
    ['pdf-a4', 'PDF A4'],
    ['pdf-a3', 'PDF A3']
  ];
</script>

<nav
  class="sticky top-3 z-20 mx-auto -mt-4 mb-8 flex w-full md:max-w-3xl flex-wrap items-center justify-between gap-2 rounded-xl border border-[#cbd8e8] bg-[#f7faff]/95 p-2.5 shadow-[0_8px_28px_rgba(23,55,95,0.17),0_1px_5px_rgba(23,55,95,0.1)] ring-1 ring-white/80 backdrop-blur-xl max-[700px]:w-auto"
  aria-label="Hlavní pohledy a export"
>
  <div class="flex items-center gap-2">
    <button
      class="tab"
      type="button"
      aria-pressed={view === 'lookup'}
      onclick={() => onView('lookup')}
    >
      <Icon name="search" size={16} filled={view === 'lookup'} /> Ověření slova
    </button>
    <button
      class="tab"
      type="button"
      aria-pressed={view === 'saved'}
      onclick={() => onView('saved')}
    >
      <Icon name="bookmark" size={16} filled={view === 'saved'} /> Můj slovník
      <span
        class="ml-1 rounded-full bg-[#e6edf8] px-2 py-px text-xs text-[#183452]"
        >{savedCount}</span
      >
    </button>
  </div>
  <div
    class="flex items-center gap-1 text-[#637791] max-md:ml-auto max-[700px]:flex-wrap"
    aria-label="Export slovníku"
  >
    <Icon name="download" size={17} />
    {#each options as option}
      <button
        class="btn bg-transparent px-2 py-1.5 text-xs text-[#4268bd]"
        type="button"
        disabled={exportDisabled}
        onclick={() => onExport(option[0])}>{option[1]}</button
      >
    {/each}
  </div>
</nav>
