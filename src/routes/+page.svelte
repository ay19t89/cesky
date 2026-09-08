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

  let session: Session | null = null;
  let authReady = false;
  let loginOpen = false;
  let email = '';
  let password = '';
  let authError = '';
  let authBusy = false;
  let word = '';
  let suggestions: string[] = [];
  let result: Lookup | null = null;
  let busy = false;
  let error = '';
  let message = '';
  let saved: Saved[] = [];
  let savedBusy = false;
  let savedError = '';
  let saving = false;
  let currentSaved = false;
  let exporting = false;
  let view: 'lookup' | 'saved' = 'lookup';
  let gender: 'all' | Gender = 'all';
  let translationLanguage: TranslationLanguage = 'rusky';
  let requestId = 0;
  let suggestionTimer: ReturnType<typeof setTimeout> | undefined;
  const translationLoads = new Set<string>();

  $: visibleSaved = saved
    .filter(
      (item) =>
        gender === 'all' ||
        item.result.ijp.entries.some((entry) => entry.gender === gender)
    )
    .sort((left, right) => compareCzechWords(left.word, right.word));

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

<header class="topbar">
  <a class="brand" href="/" aria-label="České pády – úvod">
    <Icon name="book" size={24} />
    <b>české pády</b>
    <span>OSOBNÍ SLOVNÍK</span>
  </a>
  {#if session}
    <button
      class="secondary"
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
      class="secondary"
      type="button"
      disabled={!authReady}
      onclick={() => (loginOpen = true)}
    >
      <Icon name="lock" size={16} /> Přihlásit se
    </button>
  {/if}
</header>

<main class="workspace">
  <nav class="viewbar" aria-label="Hlavní pohledy a export">
    <div class="tabs">
      <button
        class:active={view === 'lookup'}
        type="button"
        onclick={() => (view = 'lookup')}
      >
        <Icon name="search" size={16} /> Ověření slova
      </button>
      <button
        class:active={view === 'saved'}
        type="button"
        onclick={() => (view = 'saved')}
      >
        <Icon name="bookmark" size={16} /> Můj slovník
        <span class="count">{saved.length}</span>
      </button>
    </div>
    <div class="exports" aria-label="Export slovníku">
      <Icon name="download" size={17} />
      {#each [['csv', 'CSV'], ['xlsx', 'XLSX'], ['pdf-a4', 'PDF A4'], ['pdf-a3', 'PDF A3']] as option}
        <button
          class="textbutton"
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
  <h1>Čeština ve všech pádech.</h1>
  <p class="intro">Vyhledejte podstatné jméno a uložte si jeho tvary.</p>

  <section class="searchbox">
    <label for="word">Které slovo chcete skloňovat?</label>
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void check().catch(() => {});
      }}
    >
      <Icon name="search" size={25} />
      <input
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
      <button type="submit" disabled={busy || !word.trim()}>
        {#if busy}<Icon name="loader" /> Ověřuji…{:else}Ověřit slovo <Icon
            name="arrow-right"
          />{/if}
      </button>
    </form>
    <small
      >Návrhy běžných a uložených slov, i bez diakritiky. Po přihlášení také
      opravy podle příručky.</small
    >
  </section>

  {#if error}<p class="notice error" role="alert">{error}</p>{/if}

  {#if view === 'lookup'}
    {#if result}
      <section class="resultcard" aria-busy={busy}>
        <div class="resulttop">
          <div>
            <div class="eyebrow">VÝSLEDEK OVĚŘENÍ</div>
            <h2>{result.word}</h2>
            <div class="badges">
              {#each [...new Set(result.ijp.entries.map((entry) => entry.gender))] as entryGender}
                <span class="badge"
                  >{entryGender ? genders[entryGender] : 'Rod neurčen'}</span
                >
              {/each}
            </div>
            {#if result.requested !== result.word}
              <p class="correction">
                Příručka opravila „{result.requested}“ na „{result.word}“.
              </p>
            {/if}
          </div>
          <div class="savearea">
            <small>{checkedAt(result.checkedAt)}</small>
            <button
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
            {#if message}<small class="savehint"
                ><Icon name="check" size={13} /> {message}</small
              >{/if}
          </div>
        </div>

        <div class="sourcegrid">
          <div class="sourceheading">
            <span class:ok={result.ijp.status === 'ok'} class="dot"></span>
            <a
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
            <small
              >{result.ijp.status === 'ok'
                ? 'Načteno'
                : result.ijp.status === 'error'
                  ? 'Nedostupné'
                  : 'Nenalezeno'}</small
            >
          </div>
        </div>

        <div class="comparison">
          <table>
            <colgroup
              ><col class="casecolumn" /><col class="formcolumn" /><col
                class="formcolumn"
              /><col class="translationcolumn" /></colgroup
            >
            <thead>
              <tr>
                <th>Pád a otázka</th><th>Jednotné číslo</th><th>Množné číslo</th
                >
                <th class="translationhead">
                  <label
                    >Překlad
                    <select
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
                    ><div class="casecell">
                      <b>{index + 1}</b>
                      <div>
                        <strong>{name}</strong><small>{questions[index]}</small>
                      </div>
                    </div></td
                  >
                  <td>{formText(result.ijp, 'singular', index)}</td>
                  <td>{formText(result.ijp, 'plural', index)}</td>
                  {#if index === 0}
                    <td class="translationcell" rowspan={caseNames.length}>
                      {#if result.translations?.[translationLanguage]?.senses.length}
                        <div class="translationcontent">
                          {#each result.translations[translationLanguage].senses as sense}
                            <div class="translationsense">
                              {#if sense.meaning}<small>{sense.meaning}</small
                                >{/if}
                              {#if sense.translations.length}<strong
                                  >{sense.translations.join(', ')}</strong
                                >{/if}
                              {#each sense.phrases as phrase}<div
                                  class="translationphrase"
                                >
                                  <span>{phrase.source}</span><span
                                    >{phrase.target}</span
                                  >
                                </div>{/each}
                            </div>
                          {/each}
                          <a
                            class="translationmore"
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
                          class="translationfallback"
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
        {#if result.ijp.message}<p class="notice">{result.ijp.message}</p>{/if}
      </section>
    {:else}
      <section class="welcome">
        <Icon name="book" size={32} />
        <h2>Každý pád na svém místě.</h2>
        <p>Všech 7 pádů v jednotném i množném čísle, vedle sebe.</p>
      </section>
    {/if}
  {:else}
    <section class="resultcard savedcard">
      <div class="savedtop">
        <div>
          <h2>Můj slovník</h2>
          <p>{session?.user.email || 'Přihlaste se pro vlastní slovník.'}</p>
        </div>
        <button
          class="secondary refreshbutton"
          type="button"
          aria-label="Obnovit slovník"
          disabled={savedBusy || !session}
          onclick={refresh}><Icon name="refresh" size={22} /></button
        >
      </div>
      <div class="genderfilters" aria-label="Filtr rodu">
        {#each [['all', 'Vše'], ['M', 'M · životný'], ['I', 'M · neživotný'], ['F', 'Ž · ženský'], ['N', 'S · střední']] as filter}
          <button
            class:active={gender === filter[0]}
            type="button"
            onclick={() => (gender = filter[0] as 'all' | Gender)}
            >{filter[1]}</button
          >
        {/each}
      </div>
      {#if savedError}<p class="notice error">{savedError}</p>{/if}
      {#if !session}
        <div class="emptysaved">
          <Icon name="lock" size={30} />
          <p>Přihlaste se pro zobrazení vlastního slovníku.</p>
        </div>
      {:else if savedBusy && !saved.length}
        <div class="emptysaved">
          <Icon name="loader" size={30} />
          <p>Načítám slovník…</p>
        </div>
      {:else if !visibleSaved.length}
        <div class="emptysaved">
          <Icon name="bookmark" size={30} />
          <p>Váš slovník čeká na první slovo.</p>
        </div>
      {:else}
        <div class="savedtable">
          <table>
            <thead
              ><tr
                ><th>Slovo</th><th>Rod</th><th>Uloženo</th><th
                  ><label
                    >Překlad <select
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
                      onclick={(event) => event.stopPropagation()}
                      >{translationText(row.result, true)}
                      <Icon name="arrow-up-right" size={12} /></a
                    ></td
                  >
                  <td class="rowaction"
                    ><Icon name="arrow-up-right" size={17} /></td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
      <p class="exportnote">
        Export zahrnuje všechna slova z aktuálně vybraného rodu a všech 14
        pádových pozic.
      </p>
    </section>
  {/if}

  <footer>
    <span>České pády · Váš prostor pro češtinu</span><a
      href="https://prirucka.ujc.cas.cz/"
      target="_blank"
      rel="noreferrer">ÚJČ AV ČR <Icon name="arrow-up-right" size={12} /></a
    >
  </footer>
</main>

{#if loginOpen}
  <div
    class="modalbackdrop"
    role="presentation"
    onclick={() => (loginOpen = false)}
  >
    <dialog
      class="loginmodal"
      open
      aria-labelledby="login-title"
      onclick={(event) => event.stopPropagation()}
    >
      <button
        class="closebutton"
        type="button"
        aria-label="Zavřít"
        onclick={() => (loginOpen = false)}>×</button
      >
      <h2 id="login-title">Přihlášení do slovníku</h2>
      <p>Každý účet vidí pouze vlastní uložená slova.</p>
      <form onsubmit={signIn}>
        <label for="email">E-mail</label><input
          id="email"
          type="email"
          bind:value={email}
          autocomplete="email"
          required
        />
        <label for="password">Heslo</label><input
          id="password"
          type="password"
          bind:value={password}
          autocomplete="current-password"
          required
        />
        {#if authError}<p class="notice error" role="alert">{authError}</p>{/if}
        <button type="submit" disabled={authBusy}
          >{authBusy ? 'Přihlašuji…' : 'Přihlásit se'}</button
        >
      </form>
    </dialog>
  </div>
{/if}
