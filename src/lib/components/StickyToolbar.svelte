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
  class="sticky top-3 z-20 -mx-2.5 -mt-[18px] mb-[34px] flex flex-wrap items-center justify-between gap-3.5 rounded-xl border border-[#cbd8e8] bg-[#f7faff]/95 p-2.5 shadow-[0_8px_28px_rgba(23,55,95,0.17),0_1px_5px_rgba(23,55,95,0.1)] ring-1 ring-white/80 backdrop-blur-xl"
  aria-label="Hlavní pohledy a export"
>
  <div class="flex items-center gap-[7px]">
    <button
      class="tab {view === 'lookup' ? 'shadow-[inset_0_-3px_#182c47]' : ''}"
      type="button"
      onclick={() => onView('lookup')}
    >
      <Icon name="search" size={16} /> Ověření slova
    </button>
    <button
      class="tab {view === 'saved' ? 'shadow-[inset_0_-3px_#182c47]' : ''}"
      type="button"
      onclick={() => onView('saved')}
    >
      <Icon name="bookmark" size={16} /> Můj slovník
      <span
        class="ml-[3px] rounded-full bg-[#e6edf8] px-[7px] py-px text-xs text-[#183452]"
        >{savedCount}</span
      >
    </button>
  </div>
  <div
    class="flex items-center gap-[7px] text-[#637791] max-[700px]:ml-auto max-[700px]:flex-wrap"
    aria-label="Export slovníku"
  >
    <Icon name="download" size={17} />
    {#each options as option}
      <button
        class="btn bg-transparent px-[9px] py-1.5 text-[13px] text-[#2459db]"
        type="button"
        disabled={exportDisabled}
        onclick={() => onExport(option[0])}>{option[1]}</button
      >
    {/each}
  </div>
</nav>
