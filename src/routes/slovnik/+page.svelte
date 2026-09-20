<script lang="ts">
  import AppHeader from '$lib/components/AppHeader.svelte';
  import LoginDialog from '$lib/components/LoginDialog.svelte';
  import SavedDictionary from '$lib/components/SavedDictionary.svelte';
  import SearchPanel from '$lib/components/SearchPanel.svelte';
  import SiteFooter from '$lib/components/SiteFooter.svelte';
  import StickyToolbar, {
    type ExportFormat,
    type View
  } from '$lib/components/StickyToolbar.svelte';
  import { exportData } from '$lib/exports';
  import { openLookupHome, openSavedWord } from '$lib/lookup-history';
  import { createPageAuth } from '$lib/page-auth.svelte';
  import {
    findLatestSavedId,
    sortSavedWords,
    type SavedWordOrder
  } from '$lib/saved-word-order';
  import { loadSavedWords } from '$lib/saved-words';
  import { createSuggestionController } from '$lib/suggestion-controller';
  import type { Gender, Saved } from '$lib/types';
  import { onMount } from 'svelte';

  const auth = createPageAuth();
  const view: View = 'saved';
  let word = $state('');
  let suggestions = $state.raw<string[]>([]);
  let saved = $state.raw<Saved[]>([]);
  let busy = $state(false);
  let error = $state('');
  let exporting = $state(false);
  let gender = $state<'all' | Gender>('all');
  let order = $state<SavedWordOrder>('recent');
  const suggestionController = createSuggestionController({
    getWord: () => word,
    getVocabulary: () => saved.map((item) => item.word),
    setSuggestions: (nextSuggestions) => (suggestions = nextSuggestions)
  });

  const latestSavedId = $derived(findLatestSavedId(saved));
  const visibleSaved = $derived.by(() =>
    sortSavedWords(
      saved.filter(
        (item) =>
          gender === 'all' ||
          item.result.ijp.entries.some((entry) => entry.gender === gender)
      ),
      order
    )
  );

  async function loadDictionary(): Promise<void> {
    if (!auth.session) {
      saved = [];
      return;
    }
    const userId = auth.session.user.id;
    busy = true;
    error = '';
    try {
      const rows = await loadSavedWords();
      if (auth.session?.user.id === userId) saved = rows;
    } catch {
      error =
        'Slovník nelze načíst. Zkontrolujte připojení a nastavení Supabase.';
    } finally {
      busy = false;
    }
  }

  async function runExport(format: ExportFormat): Promise<void> {
    if (!visibleSaved.length) return;
    exporting = true;
    error = '';
    try {
      await exportData(
        format,
        visibleSaved.map((row) => row.result)
      );
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Export se nezdařil.';
    } finally {
      exporting = false;
    }
  }

  function selectView(nextView: View): void {
    if (nextView === 'lookup') void openLookupHome();
  }

  function searchWord(searchWord: string): void {
    if (!searchWord.trim()) return;
    suggestionController.cancel();
    void openSavedWord(searchWord.trim());
  }

  onMount(() => {
    const cleanupAuth = auth.initialize((_session, changed) => {
      if (changed) void loadDictionary();
    });
    return () => {
      cleanupAuth();
      suggestionController.cancel();
    };
  });
</script>

<svelte:head>
  <title>Můj slovník · České pády</title>
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

<main class="mx-auto max-w-300 px-3 pt-6 pb-16 sm:px-4 sm:pb-14 lg:px-8">
  <StickyToolbar
    {view}
    savedCount={saved.length}
    exportDisabled={exporting || busy || !visibleSaved.length}
    onView={selectView}
    onExport={(format) => void runExport(format)}
  />

  <div class="eyebrow">SLOVO PO SLOVU</div>
  <h1 class="mt-2 text-3xl leading-[1.2] tracking-[-1.5px] sm:text-4xl">
    Čeština ve všech pádech.
  </h1>
  <p class="mt-1 mb-6 text-neutral-500">
    Vyhledejte podstatné jméno a uložte si jeho tvary.
  </p>

  <SearchPanel
    bind:word
    {suggestions}
    {busy}
    onInput={suggestionController.update}
    onSubmit={searchWord}
  />

  <SavedDictionary
    email={auth.session?.user.email}
    {busy}
    {error}
    rows={visibleSaved}
    {latestSavedId}
    {gender}
    {order}
    onGender={(nextGender) => (gender = nextGender)}
    onOrder={(nextOrder) => (order = nextOrder)}
    onRefresh={() => void loadDictionary()}
    onOpen={(row) => void openSavedWord(row.word)}
  />
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
