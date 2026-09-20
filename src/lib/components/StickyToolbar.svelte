<script lang="ts">
  import Icon from '$lib/Icon.svelte';

  export type View = 'lookup' | 'saved' | 'patterns';
  export type ExportFormat = 'csv' | 'xlsx' | 'pdf-a4' | 'pdf-a3';

  let {
    view,
    savedCount,
    exportDisabled,
    onView,
    onExport
  }: {
    view: View;
    savedCount?: number;
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

  let exportOpen = $state(false);

  function closeExportMenu(event: MouseEvent): void {
    const target = event.target;
    if (
      exportOpen &&
      (!(target instanceof Element) || !target.closest('[data-export-menu]'))
    ) {
      exportOpen = false;
    }
  }
</script>

<svelte:window
  onclick={closeExportMenu}
  onkeydown={(event) => {
    if (event.key === 'Escape') exportOpen = false;
  }}
/>

<nav
  class={[
    'sticky top-3 z-20 min-h-14 mx-auto mb-8 flex w-full flex-wrap',
    'items-center justify-between gap-2 rounded-xl border border-[#cbd8e8]',
    'bg-neutral-50/80 p-2 ring-1 ring-white/80 backdrop-blur-lg',
    'shadow-[0_8px_28px_rgba(23,55,95,0.17),0_1px_5px_rgba(23,55,95,0.1)]',
    'md:max-w-3xl w-auto'
  ]}
  aria-label="Hlavní pohledy a export"
>
  <div class="flex items-center gap-2">
    <button
      class="tab {view === 'lookup' ? '' : 'opacity-80'}"
      type="button"
      aria-pressed={view === 'lookup'}
      onclick={() => onView('lookup')}
    >
      <Icon name={view === 'lookup' ? 'search-fill' : 'search-line'} />
      Slovo
    </button>

    <button
      class="tab {view === 'saved' ? '' : 'opacity-80'}"
      type="button"
      aria-pressed={view === 'saved'}
      onclick={() => onView('saved')}
    >
      <Icon name={view === 'saved' ? 'bookmark-fill' : 'bookmark-line'} />
      Slovník
      {#if savedCount !== undefined}
        <span class="sm:ml-1 rounded-full min-w-8 bg-neutral-200 px-1 py-0 text-[#183452]">
          {savedCount}
        </span>
      {/if}
    </button>

    <button
      class="tab {view === 'patterns' ? '' : 'opacity-80'}"
      type="button"
      aria-pressed={view === 'patterns'}
      onclick={() => onView('patterns')}
    >
      <Icon name={view === 'patterns' ? 'shapes-fill' : 'shapes-line'} />
      Vzory
    </button>
  </div>

  <details bind:open={exportOpen} data-export-menu class="relative ml-auto">
    <summary
      class={[
        'btn btn-secondary list-none p-2 text-xs text-[#4268bd]',
        '[&::-webkit-details-marker]:hidden',
        exportDisabled ? 'cursor-not-allowed opacity-50' : ''
      ]}
      aria-disabled={exportDisabled}
      onclick={(event) => {
        if (exportDisabled) event.preventDefault();
      }}
    >
      <Icon name="download-2-line" />
    </summary>

    <div
      class={[
        'absolute top-full right-0 z-30 mt-3 min-w-36 overflow-hidden',
        'rounded-lg border border-slate-200 bg-white p-1',
        'shadow-[0_12px_32px_rgba(23,55,95,0.16)]'
      ]}
      aria-label="Formát stažení"
    >
      {#each options as option (option[0])}
        <button
          class={[
            'block w-full cursor-pointer rounded-md bg-transparent px-3',
            'py-2 text-left text-sm font-bold text-blue-800/90 transition-colors',
            'hover:bg-neutral-50 hover:text-blue-600 focus:bg-neutral-50 focus:text-blue-600'
          ]}
          type="button"
          onclick={() => {
            exportOpen = false;
            onExport(option[0]);
          }}
        >
          {option[1]}
        </button>
      {/each}
    </div>

  </details>
</nav>
