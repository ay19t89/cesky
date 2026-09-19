<script lang="ts">
  import { formText } from '$lib/dictionary-format';
  import Icon from '$lib/Icon.svelte';
  import { TRANSLATION_LANGUAGES, translationUrl } from '$lib/translation';
  import { caseNames, questions, type Lookup } from '$lib/types';

  let { result }: { result: Lookup } = $props();
</script>

<div class="overflow-x-auto">
  <table
    class={[
      'data-table min-w-160 table-fixed text-sm sm:text-md',
      '[&_td:nth-child(2)]:border-l',
      '[&_td:nth-child(2)]:border-neutral-200'
    ]}
  >
    <colgroup>
      <col class="w-[30%]" />
      <col class="w-[24%]" />
      <col class="w-[24%]" />
      <col class="w-[22%]" />
    </colgroup>
    <thead>
      <tr>
        <th>Pád a otázka</th>
        <th>Jednotné číslo</th>
        <th>Množné číslo</th>
        <th class="border-l border-[#dbe3ee] text-center">Překlad</th>
      </tr>
    </thead>
    <tbody>
      {#each caseNames as caseName, index (caseName)}
        <tr>
          <td>
            <div class="flex min-w-36 items-center gap-3 sm:gap-4">
              <b
                class="grid size-7 shrink-0 place-items-center rounded-lg border border-blue-200
                  bg-neutral-50 text-sm font-medium text-blue-800/90"
              >
                {index + 1}
              </b>
              <div>
                <strong class="text-sm">{caseName}</strong>
                <small class="mt-1 block text-xs text-neutral-500">
                  {questions[index]}
                </small>
              </div>
            </div>
          </td>
          <td>{formText(result.ijp, 'singular', index)}</td>
          <td>{formText(result.ijp, 'plural', index)}</td>
          {#if index === 0}
            <td
              class="border-l border-neutral-200 text-center align-middle"
              rowspan={caseNames.length}
            >
              <div class="flex flex-col items-center gap-3 text-sm">
                {#each TRANSLATION_LANGUAGES as language}
                  <a
                    class="inline-flex items-center gap-1 font-bold text-blue-800/90 hover:text-blue-600 no-underline"
                    href={translationUrl(language, result.word)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {language.at(0)?.toUpperCase() + language.slice(1)}
                    <Icon name="arrow-right-up-line" />
                  </a>
                {/each}
              </div>
            </td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
