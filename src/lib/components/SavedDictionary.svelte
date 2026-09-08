<script lang="ts">
  import Icon from '$lib/Icon.svelte';
  import { translationUrl } from '$lib/translation';
  import { genders, type Gender, type Saved } from '$lib/types';

  let {
    email,
    busy,
    error,
    rows,
    gender,
    onGender,
    onRefresh,
    onOpen
  }: {
    email: string | undefined;
    busy: boolean;
    error: string;
    rows: Saved[];
    gender: 'all' | Gender;
    onGender: (gender: 'all' | Gender) => void;
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

<section class="panel mt-[22px] overflow-hidden">
  <div class="flex items-center justify-between px-7 pt-5">
    <div>
      <h2 class="text-[23px] tracking-[-0.5px]">Můj slovník</h2>
      <p class="mt-1.5 mb-0 text-[13px] text-[#64758c]">
        {email || 'Přihlaste se pro vlastní slovník.'}
      </p>
    </div>
    <button
      class="btn btn-secondary h-[50px] w-[50px] p-0"
      type="button"
      aria-label="Obnovit slovník"
      disabled={busy || !email}
      onclick={onRefresh}><Icon name="refresh" size={22} /></button
    >
  </div>
  <div
    class="mx-7 mt-5 mb-6 grid grid-cols-4 gap-2.5 max-[700px]:mx-[18px] max-[700px]:gap-[7px]"
    aria-label="Filtr rodu"
  >
    {#each filters as filter}
      <button
        class="btn btn-secondary min-h-11 max-[700px]:px-[5px] max-[700px]:text-xs {filter[0] ===
        'all'
          ? 'col-span-4 min-h-[50px] w-full max-w-[260px] justify-self-center text-[17px]'
          : ''} {gender === filter[0]
          ? '!border-[#2459db] !bg-[#2459db] !text-white'
          : ''}"
        type="button"
        onclick={() => onGender(filter[0])}>{filter[1]}</button
      >
    {/each}
  </div>
  {#if error}<p class="notice notice-error">{error}</p>{/if}
  {#if !email}
    <div
      class="px-6 py-[42px] text-center text-[#64758c] [&>svg]:mx-auto [&>svg]:text-[#2459db]"
    >
      <Icon name="lock" size={30} />
      <p>Přihlaste se pro zobrazení vlastního slovníku.</p>
    </div>
  {:else if busy && !rows.length}
    <div
      class="px-6 py-[42px] text-center text-[#64758c] [&>svg]:mx-auto [&>svg]:text-[#2459db]"
    >
      <Icon name="loader" size={30} />
      <p>Načítám slovník…</p>
    </div>
  {:else if !rows.length}
    <div
      class="px-6 py-[42px] text-center text-[#64758c] [&>svg]:mx-auto [&>svg]:text-[#2459db]"
    >
      <Icon name="bookmark" size={30} />
      <p>Váš slovník čeká na první slovo.</p>
    </div>
  {:else}
    <div class="overflow-x-auto px-7 max-[700px]:px-[18px]">
      <table class="data-table saved-table max-[700px]:min-w-[780px]">
        <thead>
          <tr>
            <th>Slovo</th><th>Rod</th><th>Uloženo</th><th class="text-center"
              >Překlad</th
            ><th aria-label="Otevřít detail"></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row}
            <tr
              tabindex="0"
              role="link"
              onclick={() => onOpen(row)}
              onkeydown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen(row);
                }
              }}
            >
              <td><strong>{row.word}</strong></td>
              <td
                >{row.result.ijp.entries[0]?.gender
                  ? genders[row.result.ijp.entries[0].gender]
                  : 'Rod neurčen'}</td
              >
              <td>{new Date(row.updated_at).toLocaleDateString('cs-CZ')}</td>
              <td>
                <div
                  class="flex items-center justify-center gap-4 whitespace-nowrap"
                >
                  <a
                    href={translationUrl('anglicky', row.word)}
                    target="_blank"
                    rel="noreferrer"
                    class="inline-flex items-center gap-[5px] font-bold text-[#2459db] no-underline"
                    onclick={(event) => event.stopPropagation()}
                    >Anglický <Icon name="arrow-up-right" size={12} /></a
                  >
                  <a
                    href={translationUrl('rusky', row.word)}
                    target="_blank"
                    rel="noreferrer"
                    class="inline-flex items-center gap-[5px] font-bold text-[#2459db] no-underline"
                    onclick={(event) => event.stopPropagation()}
                    >Ruský <Icon name="arrow-up-right" size={12} /></a
                  >
                </div>
              </td>
              <td class="w-[1%] text-right text-[#2459db]"
                ><Icon name="arrow-up-right" size={17} /></td
              >
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
  <p class="mx-7 mt-1 mb-[18px] text-xs text-[#64758c] max-[700px]:mx-[18px]">
    Export zahrnuje všechna slova z aktuálně vybraného rodu a všech 14 pádových
    pozic.
  </p>
</section>
