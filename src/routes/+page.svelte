<script lang="ts">
  import AppHeader from '$lib/components/AppHeader.svelte';
  import LoginDialog from '$lib/components/LoginDialog.svelte';
  import LookupEmptyState from '$lib/components/LookupEmptyState.svelte';
  import LookupResult from '$lib/components/LookupResult.svelte';
  import SavedDictionary from '$lib/components/SavedDictionary.svelte';
  import SearchPanel from '$lib/components/SearchPanel.svelte';
  import SiteFooter from '$lib/components/SiteFooter.svelte';
  import StickyToolbar, {
    type ExportFormat,
    type View
  } from '$lib/components/StickyToolbar.svelte';
  import { requestDictionary } from '$lib/dictionary-api';
  import { exportData } from '$lib/exports';
  import {
    clearLookupWord,
    getLookupWord,
    openSavedWord,
    pushLookupWord
  } from '$lib/lookup-history';
  import { createPageAuth } from '$lib/page-auth.svelte';
  import {
    findLatestSavedId,
    sortSavedWords,
    type SavedWordOrder
  } from '$lib/saved-word-order';
  import { loadSavedWords, removeWord, saveWord } from '$lib/saved-words';
  import {
    loadLearnedSuggestions,
    rememberSuggestion,
    suggest
  } from '$lib/suggestions';
  import { type Gender, type Lookup, type Saved } from '$lib/types';
  import { registerLookup } from '$lib/webmcp';
  import { onMount, tick } from 'svelte';

  const auth = createPageAuth();
  let word = $state('');
  let suggestions = $state.raw<string[]>([]);
  let result = $state.raw<Lookup | null>(null);
  let busy = $state(false);
  let error = $state('');
  let message = $state('');
  let saved = $state.raw<Saved[]>([]);
  let savedBusy = $state(false);
  let savedError = $state('');
  let saving = $state(false);
  let currentSaved = $state(false);
  let exporting = $state(false);
  let view = $state<View>('lookup');
  let gender = $state<'all' | Gender>('all');
  let savedOrder = $state<SavedWordOrder>('recent');
  let learnedSuggestions = $state.raw<string[]>([]);
  let requestId = $state(0);
  let savedForUser = $state<string | null>(null);
  let suggestionTimer = $state<ReturnType<typeof setTimeout> | undefined>();
  let suggestionRequest = $state<AbortController | undefined>();
  let savedLoad: { userId: string; promise: Promise<void> } | undefined;

  function savedLookup(value: string): Lookup | null {
    if (!auth.session) return null;
    const normalized = value.normalize('NFC').toLocaleLowerCase('cs-CZ');
    const row = saved.find(
      (item) =>
        item.word.normalize('NFC').toLocaleLowerCase('cs-CZ') === normalized
    );
    if (!row?.result.ijp.entries.length) return null;
    return {
      ...row.result,
      requested: value.trim(),
      checkedAt: row.updated_at
    };
  }

  async function scrollAfterFound(): Promise<void> {
    await tick();
    if (window.scrollY > window.innerHeight * 0.25) return;
    window.scrollBy({
      top: Math.round(window.innerHeight * 0.1),
      behavior: 'smooth'
    });
  }

  const latestSavedId = $derived(findLatestSavedId(saved));

  const visibleSaved = $derived.by(() =>
    sortSavedWords(
      saved.filter(
        (item) =>
          gender === 'all' ||
          item.result.ijp.entries.some((entry) => entry.gender === gender)
      ),
      savedOrder
    )
  );

  function updateSuggestions(): void {
    const local = suggest(word, [
      ...saved.map((item) => item.word),
      ...learnedSuggestions
    ]);
    suggestions = local;
    if (suggestionTimer) clearTimeout(suggestionTimer);
    suggestionRequest?.abort();
    if (word.trim().length < 3) return;

    const value = word.trim();
    suggestionTimer = setTimeout(() => {
      const controller = new AbortController();
      suggestionRequest = controller;
      requestDictionary(value, 'suggest', controller.signal)
        .then((data) => {
          if (word.trim() !== value) return;
          suggestions = [
            ...new Set([...(data.suggestions || []), ...local])
          ].slice(0, 8);
        })
        .catch((cause) => {
          if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
            suggestions = local;
          }
        });
    }, 650);
  }

  function loadPersonalDictionary(): Promise<void> {
    if (!auth.session) return Promise.resolve();
    const userId = auth.session.user.id;
    if (savedLoad?.userId === userId) return savedLoad.promise;
    const promise = (async () => {
      savedBusy = true;
      savedError = '';
      try {
        const rows = await loadSavedWords();
        if (auth.session?.user.id === userId) {
          saved = rows;
          savedForUser = userId;
        }
      } catch {
        savedError =
          'Slovník nelze načíst. Zkontrolujte připojení a nastavení Supabase.';
      } finally {
        savedBusy = false;
      }
    })();
    const trackedPromise = promise.finally(() => {
      if (savedLoad?.promise === trackedPromise) savedLoad = undefined;
    });
    savedLoad = { userId, promise: trackedPromise };
    return trackedPromise;
  }

  async function lookupWord(
    value = word,
    updateHistory = true
  ): Promise<Lookup> {
    if (!value.trim()) throw new Error('Zadejte slovo.');

    const activeRequest = ++requestId;
    busy = true;
    error = '';
    message = '';
    currentSaved = false;
    view = 'lookup';

    try {
      if (auth.session && savedForUser !== auth.session.user.id) {
        await loadPersonalDictionary();
      }
      const data =
        savedLookup(value) || (await requestDictionary(value.trim()));
      if (activeRequest === requestId) {
        result = data;
        word = data.word;
        if (updateHistory) pushLookupWord(data.word);
        if (updateHistory && data.ijp.entries.length) {
          void scrollAfterFound();
        }
      }
      if (!data.ijp.entries.length) return data;
      learnedSuggestions = rememberSuggestion(data.word);
      const activeSession = auth.session;
      if (!activeSession) return data;

      try {
        await saveWord(activeSession.user.id, data);
      } catch {
        error = 'Slovo bylo ověřeno, ale nepodařilo se ho automaticky uložit.';
      }
      if (!error) {
        currentSaved = true;
        message = 'Uloženo do slovníku.';
        await loadPersonalDictionary();
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

  async function toggleCurrentWordSaved(): Promise<void> {
    if (!result) return;
    if (!auth.session) {
      auth.loginOpen = true;
      return;
    }
    saving = true;
    error = '';
    message = '';
    try {
      if (currentSaved) {
        await removeWord(auth.session.user.id, result.word);
        currentSaved = false;
        message = 'Odebráno ze slovníku.';
      } else {
        await saveWord(auth.session.user.id, result);
        currentSaved = true;
        message = 'Uloženo do slovníku.';
      }
      await loadPersonalDictionary();
    } catch {
      error = 'Změnu se nepodařilo uložit. Zkontrolujte připojení.';
    } finally {
      saving = false;
    }
  }

  function showSavedWord(row: Saved): void {
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
    openSavedWord(row.word);
    showSavedWord(row);
  }

  function selectView(nextView: View): void {
    if (nextView === 'saved') {
      clearLookupWord();
    }
    view = nextView;
  }

  async function restoreHistory(state?: { view?: string }): Promise<void> {
    const value = getLookupWord();
    const matching = value
      ? saved.find((row) => row.word === value)
      : undefined;
    if (matching) {
      showSavedWord(matching);
      return;
    }
    if (value) {
      await lookupWord(value, false).catch(() => {});
      return;
    }
    view = state?.view === 'saved' ? 'saved' : 'lookup';
    result = null;
  }

  async function runExport(format: ExportFormat): Promise<void> {
    exporting = true;
    savedError = '';
    try {
      const rows =
        view === 'saved'
          ? visibleSaved.map((row) => row.result)
          : result
            ? [result]
            : [];
      if (!rows.length) return;
      await exportData(format, rows);
    } catch (cause) {
      savedError =
        cause instanceof Error ? cause.message : 'Export se nezdařil.';
    } finally {
      exporting = false;
    }
  }

  onMount(() => {
    let initialLookupStarted = false;
    learnedSuggestions = loadLearnedSuggestions();
    const cleanupAuth = auth.initialize((session, changed) => {
      if (changed) {
        currentSaved = false;
        saved = [];
        savedForUser = null;
        message = '';
        if (session) void loadPersonalDictionary();
      }
      const initialWord = getLookupWord();
      if (initialWord && !initialLookupStarted) {
        initialLookupStarted = true;
        void lookupWord(initialWord, false).catch(() => {});
      }
    });
    const cleanupWebMcp = registerLookup(lookupWord);

    return () => {
      cleanupAuth();
      cleanupWebMcp();
      if (suggestionTimer) clearTimeout(suggestionTimer);
      suggestionRequest?.abort();
    };
  });
</script>

<svelte:window onpopstate={(event) => void restoreHistory(event.state)} />

<svelte:head>
  <title>České pády</title>
</svelte:head>

<AppHeader
  signedIn={Boolean(auth.session)}
  authReady={auth.ready}
  onLogin={() => (auth.loginOpen = true)}
  onLogout={async () => {
    if (!(await auth.signOut())) {
      error = 'Odhlášení se nezdařilo. Zkuste to znovu.';
    }
  }}
/>

<main class="mx-auto max-w-300 pt-6 pb-16 px-3 sm:px-4 lg:px-8 sm:pb-14">
  <StickyToolbar
    {view}
    savedCount={saved.length}
    exportDisabled={exporting ||
      busy ||
      (view === 'saved' ? !visibleSaved.length : !result)}
    onView={selectView}
    onExport={(format) => void runExport(format)}
  />

  <div class="eyebrow">SLOVO PO SLOVU</div>
  <h1 class="mt-2 leading-[1.2] tracking-[-1.5px] text-3xl sm:text-4xl">
    Čeština ve všech pádech.
  </h1>
  <p class="mt-1 mb-6 text-neutral-500">
    Vyhledejte podstatné jméno a uložte si jeho tvary.
  </p>

  <SearchPanel
    bind:word
    {suggestions}
    {busy}
    onInput={updateSuggestions}
    onSubmit={(searchWord) => void lookupWord(searchWord).catch(() => {})}
  />

  {#if error}<p class="notice notice-error" role="alert">{error}</p>{/if}

  {#if view === 'lookup'}
    {#if result}
      <LookupResult
        {result}
        {busy}
        {saving}
        signedIn={Boolean(auth.session)}
        {currentSaved}
        {message}
        onToggleSaved={() => void toggleCurrentWordSaved()}
        onSuggestion={(suggestion) =>
          void lookupWord(suggestion).catch(() => {})}
      />
    {:else}
      <LookupEmptyState />
    {/if}
  {:else}
    <SavedDictionary
      email={auth.session?.user.email}
      busy={savedBusy}
      error={savedError}
      rows={visibleSaved}
      {latestSavedId}
      {gender}
      order={savedOrder}
      onGender={(nextGender) => (gender = nextGender)}
      onOrder={(nextOrder) => (savedOrder = nextOrder)}
      onRefresh={() => void loadPersonalDictionary()}
      onOpen={openSaved}
    />
  {/if}
  <SiteFooter />
</main>

{#if auth.loginOpen}
  <LoginDialog
    bind:email={auth.email}
    bind:password={auth.password}
    busy={auth.busy}
    error={auth.error}
    onClose={() => (auth.loginOpen = false)}
    onSubmit={auth.signIn}
  />
{/if}
