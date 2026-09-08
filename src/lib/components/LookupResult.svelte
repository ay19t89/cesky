<script lang="ts">
  import { checkedAt, formText } from '$lib/dictionary-format';
  import Icon from '$lib/Icon.svelte';
  import { ijpUrlForWord } from '$lib/ijp-url';
  import { translationUrl } from '$lib/translation';
  import { caseNames, genders, questions, type Lookup } from '$lib/types';

  let {
    result,
    busy,
    saving,
    signedIn,
    currentSaved,
    message,
    onToggleSaved
  }: {
    result: Lookup;
    busy: boolean;
    saving: boolean;
    signedIn: boolean;
    currentSaved: boolean;
    message: string;
    onToggleSaved: () => void;
  } = $props();
</script>

<section class="panel mt-[22px] overflow-hidden" aria-busy={busy}>
  <div
    class="flex justify-between gap-5 px-7 pt-7 pb-6 max-[700px]:flex-wrap max-[700px]:px-[18px] max-[700px]:pt-5"
  >
    <div>
      <div class="eyebrow">VÝSLEDEK OVĚŘENÍ</div>
      <h2 class="mt-[7px] mb-[13px] text-[38px] tracking-[-1px]">
        {result.word}
      </h2>
      <div class="flex flex-wrap gap-2">
        {#each [...new Set(result.ijp.entries.map((entry) => entry.gender))] as entryGender}
          <span
            class="rounded-[5px] border border-[#d7e5ff] bg-[#edf3ff] px-2.5 py-1 text-[13px] text-[#2459db]"
            >{entryGender ? genders[entryGender] : 'Rod neurčen'}</span
          >
        {/each}
      </div>
      {#if result.requested !== result.word}
        <p class="max-w-[650px] text-sm text-[#52647c]">
          Příručka opravila „{result.requested}“ na „{result.word}“.
        </p>
      {/if}
    </div>
    <div
      class="flex flex-col items-end justify-center gap-2.5 max-[700px]:items-start"
    >
      <small class="text-xs text-[#64758c] tabular-nums"
        >{checkedAt(result.checkedAt)}</small
      >
      <button
        class="btn"
        type="button"
        disabled={saving || busy || !signedIn || !result.ijp.entries.length}
        onclick={onToggleSaved}
      >
        <Icon name={currentSaved ? 'bookmark-check' : 'bookmark'} size={17} />
        {saving ? 'Ukládám…' : currentSaved ? 'Uloženo' : 'Uložit slovo'}
      </button>
      {#if message}<small
          class="inline-flex items-center gap-[5px] text-xs text-[#287158]"
          ><Icon name="check" size={13} /> {message}</small
        >{/if}
    </div>
  </div>

  <div class="mx-7 mb-5 max-[700px]:mx-[18px] max-[700px]:mb-[18px]">
    <div
      class="flex min-h-[50px] flex-wrap items-center gap-2 rounded-[7px] border border-[#e0e7f0] px-3 py-2.5 text-sm"
    >
      <span
        class="h-[7px] w-[7px] rounded-full {result.ijp.status === 'ok'
          ? 'bg-[#248568]'
          : 'bg-[#b58233]'}"
      ></span>
      <a
        class="inline-flex items-center gap-1 text-[#334e72] no-underline"
        href={result.ijp.entries.length
          ? ijpUrlForWord(result.word)
          : result.ijp.url}
        target="_blank"
        rel="noreferrer"
      >
        Internetová jazyková příručka <Icon name="arrow-up-right" size={14} />
      </a>
      {#if result.ijp.message}
        <span
          class="rounded-md bg-[#fff8e7] px-2.5 py-1.5 text-[12px] leading-snug text-[#795d21]"
          >{result.ijp.message}</span
        >
      {/if}
      <small class="ml-auto text-xs text-[#61738a]"
        >{result.ijp.status === 'ok'
          ? 'Načteno'
          : result.ijp.status === 'error'
            ? 'Nedostupné'
            : 'Nenalezeno'}</small
      >
    </div>
  </div>

  <div class="overflow-x-auto">
    <table
      class="data-table min-w-[850px] table-fixed text-[15px] [&_td:nth-child(2)]:border-l [&_td:nth-child(2)]:border-[#e6ecf4]"
    >
      <colgroup
        ><col class="w-[24%]" /><col class="w-[28%]" /><col
          class="w-[28%]"
        /><col class="w-[20%]" /></colgroup
      >
      <thead>
        <tr>
          <th>Pád a otázka</th><th>Jednotné číslo</th><th>Množné číslo</th>
          <th class="border-l border-[#dbe3ee] text-center">Překlad</th>
        </tr>
      </thead>
      <tbody>
        {#each caseNames as name, index}
          <tr>
            <td
              ><div class="flex min-w-[145px] items-center gap-3">
                <b
                  class="grid h-[27px] w-[27px] shrink-0 place-items-center rounded-[7px] border border-[#dae4f1] bg-[#f6f8fc] text-[13px] font-medium text-[#426086]"
                  >{index + 1}</b
                >
                <div>
                  <strong class="text-sm">{name}</strong><small
                    class="mt-0.5 block text-xs text-[#6a7a91]"
                    >{questions[index]}</small
                  >
                </div>
              </div></td
            >
            <td>{formText(result.ijp, 'singular', index)}</td>
            <td>{formText(result.ijp, 'plural', index)}</td>
            {#if index === 0}
              <td
                class="border-l border-[#e6ecf4] text-center align-middle"
                rowspan={caseNames.length}
              >
                <div
                  class="flex flex-col items-center justify-center gap-3 text-sm"
                >
                  <a
                    class="inline-flex items-center gap-[5px] font-bold text-[#2459db] no-underline"
                    href={translationUrl('anglicky', result.word)}
                    target="_blank"
                    rel="noreferrer"
                    >Anglicky <Icon name="arrow-up-right" size={13} /></a
                  >
                  <a
                    class="inline-flex items-center gap-[5px] font-bold text-[#2459db] no-underline"
                    href={translationUrl('rusky', result.word)}
                    target="_blank"
                    rel="noreferrer"
                    >Rusky <Icon name="arrow-up-right" size={13} /></a
                  >
                </div>
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
