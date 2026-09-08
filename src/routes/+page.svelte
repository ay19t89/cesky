<script lang="ts">
  import { onMount } from 'svelte';
  import type { Session } from '@supabase/supabase-js';
  import Icon from '$lib/Icon.svelte';
  import { SUPABASE_URL } from '$lib/config';
  import { compareCzechWords, exportData } from '$lib/exports';
  import { ijpUrlForWord } from '$lib/ijp-url';
  import { suggest } from '$lib/suggestions';
  import { supabase } from '$lib/supabase';
  import { translationUrl } from '$lib/translation';
  import { registerLookup } from '$lib/webmcp';
  import {
    caseNames,
    genders,
    questions,
    type Gender,
    type Lookup,
    type Saved,
    type Source,
    type TranslationLanguage,
    type Translations
  } from '$lib/types';

  type ApiResponse = Lookup & {
    suggestions?: string[];
    error?: string;
    message?: string;
  };

  let session = $state<Session | null>(null);
  let authReady = $state(false);
  let loginOpen = $state(false);
  let email = $state('');
  let password = $state('');
  let authError = $state('');
  let authBusy = $state(false);
  let word = $state('');
  let suggestions = $state<string[]>([]);
  let result = $state<Lookup | null>(null);
  let busy = $state(false);
  let error = $state('');
  let message = $state('');
  let saved = $state<Saved[]>([]);
  let savedBusy = $state(false);
  let savedError = $state('');
  let saving = $state(false);
  let currentSaved = $state(false);
  let exporting = $state(false);
  let view = $state<'lookup' | 'saved'>('lookup');
  let gender = $state<'all' | Gender>('all');
  let translationLanguage = $state<TranslationLanguage>('rusky');
  let requestId = $state(0);
  let suggestionTimer = $state<ReturnType<typeof setTimeout> | undefined>();
  const translationLoads = new Set<string>();

  const visibleSaved = $derived.by(() =>
    saved
      .filter(
        (item) =>
          gender === 'all' ||
          item.result.ijp.entries.some((entry) => entry.gender === gender)
      )
      .sort((left, right) => compareCzechWords(left.word, right.word))
  );

  function endpoint(): string {
    return `${SUPABASE_URL}/functions/v1/dictionary`;
  }

  async function dictionaryRequest(
    value: string,
    action = 'lookup',
    signal?: AbortSignal
  ): Promise<ApiResponse> {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw new Error('Pro ověření se přihlaste ke svému slovníku.');
    }

    const query = new URLSearchParams({ word: value, action });
    const response = await fetch(`${endpoint()}?${query}`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      signal
    });
    const json = (await response.json().catch(() => ({
      error: 'Služba není dostupná. Ověřte nasazení funkce dictionary.'
    }))) as ApiResponse;

    if (!response.ok) {
      throw new Error(json.error || json.message || 'Ověření se nezdařilo.');
    }
    return json;
  }

  async function translationRequest(value: string): Promise<Translations> {
    const data = await dictionaryRequest(value, 'translations');
    if (!data.translations) throw new Error('Překlad se nepodařilo načíst.');
    return data.translations;
  }

  function updateSuggestions(): void {
    const local = suggest(
      word,
      saved.map((item) => item.word)
    );
    suggestions = local;
    if (suggestionTimer) clearTimeout(suggestionTimer);
    if (!session || word.trim().length < 3) return;

    const value = word.trim();
    suggestionTimer = setTimeout(() => {
      dictionaryRequest(value, 'suggest')
        .then((data) => {
          suggestions = [
            ...new Set([...(data.suggestions || []), ...local])
          ].slice(0, 8);
        })
        .catch(() => {});
    }, 650);
  }

  async function refresh(): Promise<void> {
    if (!session) return;
    const userId = session.user.id;
    savedBusy = true;
    savedError = '';
    try {
      const rows: Saved[] = [];
      for (let offset = 0; ; offset += 500) {
        const response = await supabase
          .from('czech_words')
          .select('id,word,result,updated_at')
          .order('updated_at', { ascending: false })
          .range(offset, offset + 499);
        if (response.error) throw response.error;
        rows.push(...(response.data as Saved[]));
        if (response.data.length < 500) break;
      }
      if (session?.user.id === userId) {
        saved = rows;
        void hydrateTranslations(rows, userId);
      }
    } catch {
      savedError =
        'Slovník nelze načíst. Zkontrolujte připojení a nastavení Supabase.';
    } finally {
      savedBusy = false;
    }
  }

  async function hydrateTranslations(
    rows: Saved[],
    userId: string
  ): Promise<void> {
    const queue = rows.filter(
      (row) => !row.result.translations && !translationLoads.has(row.id)
    );

    async function worker(): Promise<void> {
      while (queue.length && session?.user.id === userId) {
        const row = queue.shift();
        if (!row) return;
        translationLoads.add(row.id);
        try {
          const translations = await translationRequest(row.word);
          const enrichedResult = { ...row.result, translations };
          const response = await supabase
            .from('czech_words')
            .update({ result: enrichedResult, updated_at: row.updated_at })
            .eq('id', row.id)
            .eq('user_id', userId);
          if (response.error) throw response.error;
          saved = saved.map((item) =>
            item.id === row.id ? { ...item, result: enrichedResult } : item
          );
          if (result?.word === row.word) result = enrichedResult;
        } catch {
          // Translation links remain available when a preview cannot be loaded.
        }
      }
    }

    await Promise.all([worker(), worker(), worker()]);
  }

  async function check(value = word): Promise<Lookup> {
    if (!value.trim()) throw new Error('Zadejte slovo.');
    if (!session) {
      loginOpen = true;
      throw new Error('Pro ověření se přihlaste.');
    }

    const activeRequest = ++requestId;
    busy = true;
    error = '';
    message = '';
    currentSaved = false;
    view = 'lookup';

    try {
      const data = await dictionaryRequest(value.trim());
      if (activeRequest === requestId) {
        result = data;
        word = data.word;
      }
      if (!data.ijp.entries.length) return data;

      const response = await supabase.from('czech_words').upsert(
        {
          word: data.word,
          result: data,
          user_id: session.user.id,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id,word' }
      );
      if (response.error) {
        error = 'Slovo bylo ověřeno, ale nepodařilo se ho automaticky uložit.';
      } else {
        currentSaved = true;
        message = 'Uloženo do slovníku.';
        await refresh();
      }
      return data;
    } catch (cause) {
      if (activeRequest === requestId) {
        error =
          cause instanceof Error ? cause.message : 'Ověření se nezdařilo.';
      }
      throw cause;
    } finally {
      if (activeRequest === requestId) busy = false;
    }
  }

  async function signIn(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    authBusy = true;
    authError = '';
    try {
      const response = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (response.error) throw response.error;
      password = '';
      loginOpen = false;
    } catch {
      authError =
        'Přihlášení se nezdařilo. Zkontrolujte e-mail, heslo a připojení.';
    } finally {
      authBusy = false;
    }
  }

  async function toggleSaved(): Promise<void> {
    if (!result || !session) return;
    saving = true;
    error = '';
    message = '';
    try {
      if (currentSaved) {
        const response = await supabase
          .from('czech_words')
          .delete()
          .eq('user_id', session.user.id)
          .eq('word', result.word);
        if (response.error) throw response.error;
        currentSaved = false;
        message = 'Odebráno ze slovníku.';
      } else {
        const response = await supabase.from('czech_words').upsert(
          {
            word: result.word,
            result,
            user_id: session.user.id,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id,word' }
        );
        if (response.error) throw response.error;
        currentSaved = true;
        message = 'Uloženo do slovníku.';
      }
      await refresh();
    } catch {
      error = 'Změnu se nepodařilo uložit. Zkontrolujte připojení.';
    } finally {
      saving = false;
    }
  }

  function showSaved(row: Saved): void {
    requestId += 1;
    busy = false;
    result = row.result;
    currentSaved = true;
    word = row.word;
    view = 'lookup';
    error = '';
    message = '';
  }

  function openSaved(row: Saved): void {
    const currentUrl = new URL(window.location.href);
    window.history.replaceState({ view: 'saved' }, '', currentUrl);
    currentUrl.searchParams.set('slovo', row.word);
    window.history.pushState(
      { view: 'lookup', word: row.word },
      '',
      currentUrl
    );
    showSaved(row);
  }

  function restoreHistory(state?: { view?: string }): void {
    const value = new URL(window.location.href).searchParams.get('slovo');
    const matching = value
      ? saved.find((row) => row.word === value)
      : undefined;
    if (matching) {
      showSaved(matching);
      return;
    }
    view = state?.view === 'saved' ? 'saved' : 'lookup';
    if (view === 'saved') result = null;
  }

  async function runExport(
    format: 'csv' | 'xlsx' | 'pdf-a4' | 'pdf-a3'
  ): Promise<void> {
    exporting = true;
    savedError = '';
    try {
      await exportData(
        format,
        visibleSaved.map((row) => row.result)
      );
    } catch (cause) {
      savedError =
        cause instanceof Error ? cause.message : 'Export se nezdařil.';
    } finally {
      exporting = false;
    }
  }

  function formText(
    source: Source,
    number: 'singular' | 'plural',
    index: number
  ): string {
    if (!source.entries.length) return '—';
    return source.entries
      .map((entry) => entry[number][index]?.join(', ') || '—')
      .join(' · ');
  }

  function translationText(item: Lookup, compact = false): string {
    const source = item.translations?.[translationLanguage];
    if (!source?.senses.length) return source?.message || 'Otevřít překlad';
    const first = source.senses[0];
    const text =
      first.translations.join(', ') ||
      first.phrases[0]?.target ||
      'Otevřít překlad';
    return compact
      ? text
      : source.senses
          .map((sense) => sense.translations.join(', '))
          .filter(Boolean)
          .join('; ');
  }

  function translationHref(item: Lookup): string {
    return (
      item.translations?.[translationLanguage]?.url ||
      translationUrl(translationLanguage, item.word)
    );
  }

  function checkedAt(value: string): string {
    return new Date(value).toLocaleString('cs-CZ', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  onMount(() => {
    let cleanupWebMcp = () => {};
    const popstate = (event: PopStateEvent) => restoreHistory(event.state);
    window.addEventListener('popstate', popstate);

    supabase.auth.getSession().then(({ data }) => {
      session = data.session;
      authReady = true;
      if (session) void refresh();
    });
    const { data } = supabase.auth.onAuthStateChange((_, nextSession) => {
      const changed = session?.user.id !== nextSession?.user.id;
      session = nextSession;
      authReady = true;
      if (changed) {
        translationLoads.clear();
        result = null;
        currentSaved = false;
        saved = [];
        message = '';
        if (session) void refresh();
      }
    });
    cleanupWebMcp = registerLookup(check);

    return () => {
      data.subscription.unsubscribe();
      cleanupWebMcp();
      window.removeEventListener('popstate', popstate);
      if (suggestionTimer) clearTimeout(suggestionTimer);
    };
  });
</script>

<svelte:head>
  <title>České pády</title>
</svelte:head>

<header
  class="flex items-center justify-between border-b border-[#dbe3ee] bg-white px-[5vw] py-[22px]"
>
  <a
    class="flex items-center gap-3 text-[23px] tracking-[-0.6px] text-[#182c47] no-underline [&>svg]:text-[#2459db]"
    href="/"
    aria-label="České pády – úvod"
  >
    <Icon name="book" size={24} />
    <b>české pády</b>
    <span
      class="ml-3.5 border-l border-[#dbe3ee] pl-[22px] text-xs font-bold tracking-[1.6px] text-[#6a7a91] max-[700px]:hidden"
      >OSOBNÍ SLOVNÍK</span
    >
  </a>
  {#if session}
    <button
      class="btn btn-secondary"
      type="button"
      onclick={async () => {
        const response = await supabase.auth.signOut();
        if (response.error) error = 'Odhlášení se nezdařilo. Zkuste to znovu.';
      }}
    >
      <Icon name="logout" size={16} /> Odhlásit se
    </button>
  {:else}
    <button
      class="btn btn-secondary"
      type="button"
      disabled={!authReady}
      onclick={() => (loginOpen = true)}
    >
      <Icon name="lock" size={16} /> Přihlásit se
    </button>
  {/if}
</header>

<main
  class="mx-auto max-w-[1440px] px-7 pt-12 pb-16 max-[700px]:px-[18px] max-[700px]:pt-[30px] max-[700px]:pb-[55px]"
>
  <nav
    class="sticky top-3 z-20 -mx-2.5 -mt-[18px] mb-[34px] flex flex-wrap items-center justify-between gap-3.5 rounded-xl border border-[#cbd8e8] bg-[#f7faff]/95 p-2.5 shadow-[0_8px_28px_rgba(23,55,95,0.17),0_1px_5px_rgba(23,55,95,0.1)] ring-1 ring-white/80 backdrop-blur-xl"
    aria-label="Hlavní pohledy a export"
  >
    <div class="flex items-center gap-[7px]">
      <button
        class="tab {view === 'lookup' ? 'shadow-[inset_0_-3px_#182c47]' : ''}"
        type="button"
        onclick={() => (view = 'lookup')}
      >
        <Icon name="search" size={16} /> Ověření slova
      </button>
      <button
        class="tab {view === 'saved' ? 'shadow-[inset_0_-3px_#182c47]' : ''}"
        type="button"
        onclick={() => (view = 'saved')}
      >
        <Icon name="bookmark" size={16} /> Můj slovník
        <span
          class="ml-[3px] rounded-full bg-[#e6edf8] px-[7px] py-px text-xs text-[#183452]"
          >{saved.length}</span
        >
      </button>
    </div>
    <div
      class="flex items-center gap-[7px] text-[#637791] max-[700px]:ml-auto max-[700px]:flex-wrap"
      aria-label="Export slovníku"
    >
      <Icon name="download" size={17} />
      {#each [['csv', 'CSV'], ['xlsx', 'XLSX'], ['pdf-a4', 'PDF A4'], ['pdf-a3', 'PDF A3']] as option}
        <button
          class="btn bg-transparent px-[9px] py-1.5 text-[13px] text-[#2459db]"
          type="button"
          disabled={exporting || !visibleSaved.length}
          onclick={() =>
            runExport(option[0] as 'csv' | 'xlsx' | 'pdf-a4' | 'pdf-a3')}
          >{option[1]}</button
        >
      {/each}
    </div>
  </nav>

  <div class="eyebrow">SLOVO PO SLOVU</div>
  <h1
    class="mt-[9px] text-[38px] leading-[1.2] tracking-[-1.5px] max-[700px]:text-[30px]"
  >
    Čeština ve všech pádech.
  </h1>
  <p class="mt-0.5 mb-[22px] text-[#52647c]">
    Vyhledejte podstatné jméno a uložte si jeho tvary.
  </p>

  <section class="panel p-6 shadow-[0_6px_20px_#152e5510] max-[700px]:p-[17px]">
    <label class="mb-2.5 block text-sm font-bold" for="word"
      >Které slovo chcete skloňovat?</label
    >
    <form
      class="flex items-center gap-3.5 max-[700px]:flex-wrap"
      onsubmit={(event) => {
        event.preventDefault();
        void check().catch(() => {});
      }}
    >
      <Icon name="search" size={25} />
      <input
        class="min-w-[100px] flex-1 rounded-[7px] border-0 bg-white px-2 py-[11px] text-xl text-[#182c47]"
        id="word"
        bind:value={word}
        oninput={updateSuggestions}
        list="word-suggestions"
        maxlength="80"
        autocomplete="off"
        placeholder="Například kamarád, žena nebo město"
      />
      <datalist id="word-suggestions">
        {#each suggestions as suggestion}<option value={suggestion}
          ></option>{/each}
      </datalist>
      <button
        class="btn max-[700px]:w-full"
        type="submit"
        disabled={busy || !word.trim()}
      >
        {#if busy}<Icon name="loader" /> Ověřuji…{:else}Ověřit slovo <Icon
            name="arrow-right"
          />{/if}
      </button>
    </form>
    <small class="mt-3 block text-[13px] text-[#6a7a91]"
      >Návrhy běžných a uložených slov, i bez diakritiky. Po přihlášení také
      opravy podle příručky.</small
    >
  </section>

  {#if error}<p class="notice notice-error" role="alert">{error}</p>{/if}

  {#if view === 'lookup'}
    {#if result}
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
              disabled={saving ||
                busy ||
                !session ||
                !result.ijp.entries.length}
              onclick={toggleSaved}
            >
              <Icon
                name={currentSaved ? 'bookmark-check' : 'bookmark'}
                size={17}
              />
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
              Internetová jazyková příručka <Icon
                name="arrow-up-right"
                size={14}
              />
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
            class="data-table min-w-[800px] table-fixed text-[15px] [&_td:nth-child(2)]:border-l [&_td:nth-child(2)]:border-[#e6ecf4]"
          >
            <colgroup
              ><col class="w-[24%]" /><col class="w-[28%]" /><col
                class="w-[28%]"
              /><col class="w-[20%]" /></colgroup
            >
            <thead>
              <tr>
                <th>Pád a otázka</th><th>Jednotné číslo</th><th>Množné číslo</th
                >
                <th class="border-l border-[#dbe3ee] text-center">
                  <label
                    class="inline-flex items-center justify-center gap-[7px]"
                    >Překlad
                    <select
                      class="select"
                      bind:value={translationLanguage}
                      aria-label="Jazyk překladu"
                      ><option value="rusky">RU</option><option value="anglicky"
                        >EN</option
                      ></select
                    >
                  </label>
                </th>
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
                      {#if result.translations?.[translationLanguage]?.senses.length}
                        <div
                          class="flex max-h-[350px] flex-col gap-[13px] overflow-y-auto px-1 py-0.5 text-left"
                        >
                          {#each result.translations[translationLanguage].senses as sense}
                            <div class="flex flex-col gap-[5px]">
                              {#if sense.meaning}<small class="text-[#64758c]"
                                  >{sense.meaning}</small
                                >{/if}
                              {#if sense.translations.length}<strong
                                  class="text-sm text-[#162e49]"
                                  >{sense.translations.join(', ')}</strong
                                >{/if}
                              {#each sense.phrases as phrase}<div
                                  class="grid gap-px pt-[3px] text-xs leading-[1.35] [&>span:last-child]:text-[#52647c]"
                                >
                                  <span>{phrase.source}</span><span
                                    >{phrase.target}</span
                                  >
                                </div>{/each}
                            </div>
                          {/each}
                          <a
                            class="inline-flex items-center justify-center gap-[5px] border-t border-[#e3e9f1] pt-2.5 text-xs font-bold no-underline"
                            href={translationHref(result)}
                            target="_blank"
                            rel="noreferrer"
                            >Seznam Slovník <Icon
                              name="arrow-up-right"
                              size={13}
                            /></a
                          >
                        </div>
                      {:else}
                        <a
                          class="inline-flex items-center justify-center gap-[5px] text-xs font-bold no-underline"
                          href={translationHref(result)}
                          target="_blank"
                          rel="noreferrer"
                          >{translationText(result)}
                          <Icon name="arrow-up-right" size={13} /></a
                        >
                      {/if}
                    </td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {:else}
      <section
        class="mt-[22px] rounded-xl border border-dashed border-[#cbd6e6] bg-[#f9fbff] px-6 py-[52px] text-center [&>svg]:mx-auto [&>svg]:text-[#2459db]"
      >
        <Icon name="book" size={32} />
        <h2 class="mt-3.5 text-[23px] tracking-[-0.5px]">
          Každý pád na svém místě.
        </h2>
        <p class="text-[#52647c]">
          Všech 7 pádů v jednotném i množném čísle, vedle sebe.
        </p>
      </section>
    {/if}
  {:else}
    <section class="panel mt-[22px] overflow-hidden">
      <div class="flex items-center justify-between px-7 pt-[22px]">
        <div>
          <h2 class="text-[23px] tracking-[-0.5px]">Můj slovník</h2>
          <p class="mt-1.5 mb-0 text-[13px] text-[#64758c]">
            {session?.user.email || 'Přihlaste se pro vlastní slovník.'}
          </p>
        </div>
        <button
          class="btn btn-secondary h-[50px] w-[50px] p-0"
          type="button"
          aria-label="Obnovit slovník"
          disabled={savedBusy || !session}
          onclick={refresh}><Icon name="refresh" size={22} /></button
        >
      </div>
      <div
        class="mx-7 mt-5 mb-6 grid grid-cols-4 gap-2.5 max-[700px]:mx-[18px] max-[700px]:gap-[7px]"
        aria-label="Filtr rodu"
      >
        {#each [['all', 'Vše'], ['M', 'M · životný'], ['I', 'M · neživotný'], ['F', 'Ž · ženský'], ['N', 'S · střední']] as filter}
          <button
            class="btn btn-secondary min-h-11 max-[700px]:px-[5px] max-[700px]:text-xs {filter[0] ===
            'all'
              ? 'col-span-4 min-h-[50px] w-full max-w-[260px] justify-self-center text-[17px]'
              : ''} {gender === filter[0]
              ? '!border-[#2459db] !bg-[#2459db] !text-white'
              : ''}"
            type="button"
            onclick={() => (gender = filter[0] as 'all' | Gender)}
            >{filter[1]}</button
          >
        {/each}
      </div>
      {#if savedError}<p class="notice notice-error">{savedError}</p>{/if}
      {#if !session}
        <div
          class="px-6 py-[42px] text-center text-[#64758c] [&>svg]:mx-auto [&>svg]:text-[#2459db]"
        >
          <Icon name="lock" size={30} />
          <p>Přihlaste se pro zobrazení vlastního slovníku.</p>
        </div>
      {:else if savedBusy && !saved.length}
        <div
          class="px-6 py-[42px] text-center text-[#64758c] [&>svg]:mx-auto [&>svg]:text-[#2459db]"
        >
          <Icon name="loader" size={30} />
          <p>Načítám slovník…</p>
        </div>
      {:else if !visibleSaved.length}
        <div
          class="px-6 py-[42px] text-center text-[#64758c] [&>svg]:mx-auto [&>svg]:text-[#2459db]"
        >
          <Icon name="bookmark" size={30} />
          <p>Váš slovník čeká na první slovo.</p>
        </div>
      {:else}
        <div class="overflow-x-auto px-7 max-[700px]:px-[18px]">
          <table class="data-table saved-table max-[700px]:min-w-[780px]">
            <thead
              ><tr
                ><th>Slovo</th><th>Rod</th><th>Uloženo</th><th
                  ><label
                    >Překlad <select
                      class="select"
                      bind:value={translationLanguage}
                      aria-label="Jazyk překladu"
                      ><option value="rusky">RU</option><option value="anglicky"
                        >EN</option
                      ></select
                    ></label
                  ></th
                ><th aria-label="Otevřít detail"></th></tr
              ></thead
            >
            <tbody>
              {#each visibleSaved as row}
                <tr
                  tabindex="0"
                  role="link"
                  onclick={() => openSaved(row)}
                  onkeydown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openSaved(row);
                    }
                  }}
                >
                  <td><strong>{row.word}</strong></td>
                  <td
                    >{row.result.ijp.entries[0]?.gender
                      ? genders[row.result.ijp.entries[0].gender]
                      : 'Rod neurčen'}</td
                  >
                  <td>{new Date(row.updated_at).toLocaleDateString('cs-CZ')}</td
                  >
                  <td
                    ><a
                      href={translationHref(row.result)}
                      target="_blank"
                      rel="noreferrer"
                      class="inline-flex items-center gap-[5px] font-bold no-underline"
                      onclick={(event) => event.stopPropagation()}
                      >{translationText(row.result, true)}
                      <Icon name="arrow-up-right" size={12} /></a
                    ></td
                  >
                  <td class="w-[1%] text-right text-[#2459db]"
                    ><Icon name="arrow-up-right" size={17} /></td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
      <p
        class="mx-7 mt-1 mb-[18px] text-xs text-[#64758c] max-[700px]:mx-[18px]"
      >
        Export zahrnuje všechna slova z aktuálně vybraného rodu a všech 14
        pádových pozic.
      </p>
    </section>
  {/if}

  <footer
    class="mt-8 flex justify-between gap-5 text-xs text-[#738398] max-[700px]:flex-wrap"
  >
    <span>České pády · Váš prostor pro češtinu</span><a
      href="https://prirucka.ujc.cas.cz/"
      target="_blank"
      rel="noreferrer"
      class="inline-flex items-center gap-1 text-[#52647c] no-underline"
      >ÚJČ AV ČR <Icon name="arrow-up-right" size={12} /></a
    >
  </footer>
</main>

{#if loginOpen}
  <div
    class="fixed inset-0 z-50 grid place-items-center bg-[#10203980] p-5"
    role="presentation"
    onclick={() => (loginOpen = false)}
  >
    <dialog
      class="relative m-0 w-full max-w-[440px] rounded-[14px] border-0 bg-white p-[26px] text-[#182c47] shadow-[0_24px_80px_#1020393b]"
      open
      aria-labelledby="login-title"
      onclick={(event) => event.stopPropagation()}
    >
      <button
        class="absolute top-3 right-3 h-9 w-9 bg-transparent p-0 text-2xl text-[#52647c]"
        type="button"
        aria-label="Zavřít"
        onclick={() => (loginOpen = false)}>×</button
      >
      <h2 id="login-title">Přihlášení do slovníku</h2>
      <p class="text-[#64758c]">Každý účet vidí pouze vlastní uložená slova.</p>
      <form class="flex flex-col gap-2.5" onsubmit={signIn}>
        <label class="text-sm font-bold" for="email">E-mail</label><input
          class="rounded-[7px] border border-[#dbe3ee] px-[13px] py-[11px]"
          id="email"
          type="email"
          bind:value={email}
          autocomplete="email"
          required
        />
        <label class="text-sm font-bold" for="password">Heslo</label><input
          class="rounded-[7px] border border-[#dbe3ee] px-[13px] py-[11px]"
          id="password"
          type="password"
          bind:value={password}
          autocomplete="current-password"
          required
        />
        {#if authError}<p class="notice notice-error" role="alert">
            {authError}
          </p>{/if}
        <button class="btn" type="submit" disabled={authBusy}
          >{authBusy ? 'Přihlašuji…' : 'Přihlásit se'}</button
        >
      </form>
    </dialog>
  </div>
{/if}
