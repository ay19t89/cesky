<script lang="ts">
  import Icon from '$lib/Icon.svelte';
  import SavedWordsTable from '$lib/components/SavedWordsTable.svelte';
  import type { SavedWordOrder } from '$lib/saved-word-order';
  import type { Gender, Saved } from '$lib/types';

  let {
    email,
    busy,
    error,
    rows,
    latestSavedId,
    gender,
    order,
    onGender,
    onOrder,
    onRefresh,
    onOpen
  }: {
    email: string | undefined;
    busy: boolean;
    error: string;
    rows: Saved[];
    latestSavedId: string | undefined;
    gender: 'all' | Gender;
    order: SavedWordOrder;
    onGender: (gender: 'all' | Gender) => void;
    onOrder: (order: SavedWordOrder) => void;
    onRefresh: () => void;
    onOpen: (row: Saved) => void;
  } = $props();

  const filters: ['all' | Gender, string][] = [
    ['all', 'Vše'],
    ['M', 'M · životný'],
    ['I', 'M · neživotný'],
    ['F', 'Ž · ženský'],
    ['N', 'S · střední']
  ];
</script>

<section class="panel mt-7 overflow-hidden">
  <div class="flex items-start justify-between gap-4 px-7 pt-5">
    <div>
      <h2 class="text-[23px] tracking-[-0.5px]">Můj slovník</h2>
      <p class="mt-2 mb-0 text-[13px] text-[#64758c]">
        {email || 'Přihlaste se pro vlastní slovník.'}
      </p>
    </div>
    <div class="flex flex-wrap items-center justify-end gap-2">
      <div
        class="flex rounded-lg border border-[#dbe3ee] bg-[#f4f7fc] p-1"
        aria-label="Řazení slov"
      >
        <button
          class="btn min-h-9 px-3 py-1 text-xs {order === 'alphabetical'
            ? ''
            : 'btn-secondary border-transparent! bg-transparent!'}"
          type="button"
          aria-pressed={order === 'alphabetical'}
          onclick={() => onOrder('alphabetical')}
        >
          <Icon name="sort-asc" /> Abecedně
        </button>
        <button
          class="btn min-h-9 px-3 py-1 text-xs {order === 'recent'
            ? ''
            : 'btn-secondary border-transparent! bg-transparent!'}"
          type="button"
          aria-pressed={order === 'recent'}
          onclick={() => onOrder('recent')}
        >
          <Icon name="time-line" /> Nejnovější
        </button>
      </div>
      <button
        class="btn btn-secondary size-11 p-0"
        type="button"
        aria-label="Obnovit slovník"
        disabled={busy || !email}
        onclick={onRefresh}><Icon name="refresh-line" /></button
      >
    </div>
  </div>
  <div
    class="m-6 grid grid-cols-4 gap-2 max-[700px]:mx-4 max-[700px]:gap-2"
    aria-label="Filtr rodu"
  >
    {#each filters as filter (filter[0])}
      <button
        class="btn btn-secondary min-h-10 sm:px-1 sm:text-xs
          {filter[0] === 'all'
          ? 'col-span-4 min-h-12 w-full max-w-60 justify-self-center text-md'
          : ''}
          {gender === filter[0]
          ? 'border-[#4268bd]! bg-[#4268bd]! text-white!'
          : ''}"
        type="button"
        onclick={() => onGender(filter[0])}>{filter[1]}</button
      >
    {/each}
  </div>
  {#if error}<p class="notice notice-error">{error}</p>{/if}
  {#if !email}
    <div
      class="px-6 py-10 text-center text-[#64758c] [&>i]:mx-auto [&>i]:text-[#4268bd]"
    >
      <Icon name="lock-line" />
      <p>Přihlaste se pro zobrazení vlastního slovníku.</p>
    </div>
  {:else if busy && !rows.length}
    <div
      class="px-6 py-10 text-center text-[#64758c] [&>i]:mx-auto [&>i]:animate-spin [&>i]:text-[#4268bd]"
    >
      <Icon name="loader-4-line" />
      <p>Načítám slovník…</p>
    </div>
  {:else if !rows.length}
    <div
      class="px-6 py-10 text-center text-[#64758c] [&>i]:mx-auto [&>i]:text-[#4268bd]"
    >
      <Icon name="bookmark-line" />
      <p>Váš slovník čeká na první slovo.</p>
    </div>
  {:else}
    <SavedWordsTable {rows} {latestSavedId} {onOpen} />
  {/if}
  <p class="mx-7 mt-1 mb-4 text-xs text-[#64758c] max-[700px]:mx-4">
    Export zahrnuje všechna slova z aktuálně vybraného rodu a všech 14 pádových
    pozic.
  </p>
</section>
