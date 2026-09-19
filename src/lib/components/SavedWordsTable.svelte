<script lang="ts">
  import Icon from '$lib/Icon.svelte';
  import { TRANSLATION_LANGUAGES, translationUrl } from '$lib/translation';
  import { genders, type Saved } from '$lib/types';

  let {
    rows,
    latestSavedId,
    onOpen
  }: {
    rows: Saved[];
    latestSavedId: string | undefined;
    onOpen: (row: Saved) => void;
  } = $props();

  function openWithKeyboard(event: KeyboardEvent, row: Saved): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onOpen(row);
  }
</script>

<div class="overflow-x-auto px-4 md:px-6">
  <table class="data-table saved-table min-w-160">
    <colgroup>
      <col class="w-[22%]" />
      <col class="w-[24%]" />
      <col class="w-[22%]" />
      <col class="w-[24%]" />
      <col class="w-[5%]" />
    </colgroup>
    <thead>
      <tr>
        <th>Slovo</th>
        <th>Rod</th>
        <th>Uloženo</th>
        <th class="text-center">Překlad</th>
        <th aria-label="Otevřít detail"></th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row (row.id)}
        <tr
          class={row.id === latestSavedId ? 'bg-[#e0f0e8]/70' : ''}
          tabindex="0"
          role="link"
          aria-label={`${row.word}${row.id === latestSavedId ? ', naposledy přidáno' : ''}`}
          onclick={() => onOpen(row)}
          onkeydown={(event) => openWithKeyboard(event, row)}
        >
          <td><strong>{row.word}</strong></td>

          <td>
            {row.result.ijp.entries[0]?.gender
              ? genders[row.result.ijp.entries[0].gender]
              : 'Rod neurčen'}
          </td>

          <td>{new Date(row.updated_at).toLocaleDateString('cs-CZ')}</td>

          <td>
            <div class="flex justify-center gap-4 whitespace-nowrap">
              {#each TRANSLATION_LANGUAGES as language}
                <a
                  href={translationUrl(language, row.word)}
                  target="_blank"
                  rel="noreferrer"
                  class="inline-flex items-center gap-1 font-bold text-blue-800/90 hover:text-blue-600 no-underline"
                  onclick={(event) => event.stopPropagation()}
                >
                  {language.at(0)?.toUpperCase() + language.slice(1)}
                  <Icon name="arrow-right-up-line" />
                </a>
              {/each}
            </div>
          </td>

          <td class="text-right text-[#4268bd]">
            <Icon name="arrow-right-up-line" />
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
