<script lang="ts">
  import {
    getAppShell,
    type ExportFormat,
    type ToolbarRegistration
  } from '$lib/app-shell.svelte';
  import LookupEmptyState from '$lib/components/LookupEmptyState.svelte';
  import LookupResult from '$lib/components/LookupResult.svelte';
  import SearchPanel from '$lib/components/SearchPanel.svelte';
  import SiteFooter from '$lib/components/SiteFooter.svelte';
  import { requestDictionary } from '$lib/dictionary-api';
  import { exportData } from '$lib/exports';
  import { getLookupWord, pushLookupWord } from '$lib/lookup-history';
  import { createPageAuth } from '$lib/page-auth.svelte';
  import { loadSavedWordCount, removeWord, saveWord } from '$lib/saved-words';
  import { createSuggestionController } from '$lib/suggestion-controller';
  import type { Lookup } from '$lib/types';
  import { registerLookup } from '$lib/webmcp';
  import { onMount, tick } from 'svelte';

  const auth = createPageAuth();
  const shell = getAppShell();
  let word = $state('');
  let suggestions = $state.raw<string[]>([]);
  let result = $state.raw<Lookup | null>(null);
  let busy = $state(false);
  let error = $state('');
  let message = $state('');
  let saving = $state(false);
  let currentSaved = $state(false);
  let exporting = $state(false);
  let savedCount = $state(0);
  let requestId = $state(0);
  const toolbar: ToolbarRegistration = {
    get savedCount() {
      return savedCount;
    },
    get exportDisabled() {
      return exporting || busy || !result;
    },
    onExport: (format) => void runExport(format)
  };
  const suggestionController = createSuggestionController({
    getWord: () => word,
    setSuggestions: (nextSuggestions) => (suggestions = nextSuggestions)
  });

  async function refreshSavedCount(): Promise<void> {
    if (!auth.session) {
      savedCount = 0;
      return;
    }

    const userId = auth.session.user.id;
    try {
      const count = await loadSavedWordCount();
      if (auth.session?.user.id === userId) savedCount = count;
    } catch {
      savedCount = 0;
    }
  }

  async function scrollAfterFound(): Promise<void> {
    await tick();
    if (window.scrollY > window.innerHeight * 0.25) return;
    window.scrollBy({
      top: Math.round(window.innerHeight * 0.1),
      behavior: 'smooth'
    });
  }

  async function lookupWord(
    value = word,
    updateHistory = true
  ): Promise<Lookup> {
    if (!value.trim()) throw new Error('Zadejte slovo.');

    const activeRequest = ++requestId;
    busy = true;
    suggestionController.cancel();
    error = '';
    message = '';
    currentSaved = false;

    try {
      const data = await requestDictionary(value.trim());
      if (activeRequest === requestId) {
        result = data;
        word = data.word;
        if (updateHistory) pushLookupWord(data.word);
        if (updateHistory && data.ijp.entries.length) {
          void scrollAfterFound();
        }
      }
      if (!data.ijp.entries.length) return data;

      suggestionController.remember(data.word);
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
        await refreshSavedCount();
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
      shell.openLogin();
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
      await refreshSavedCount();
    } catch {
      error = 'Změnu se nepodařilo uložit. Zkontrolujte připojení.';
    } finally {
      saving = false;
    }
  }

  async function restoreHistory(): Promise<void> {
    const value = getLookupWord();
    if (value) {
      await lookupWord(value, false).catch(() => {});
      return;
    }
    result = null;
  }

  async function runExport(format: ExportFormat): Promise<void> {
    if (!result) return;
    exporting = true;
    error = '';
    try {
      await exportData(format, [result]);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Export se nezdařil.';
    } finally {
      exporting = false;
    }
  }

  onMount(() => {
    const unregisterToolbar = shell.registerToolbar(toolbar);
    let initialLookupStarted = false;
    const cleanupAuth = auth.initialize((_session, changed) => {
      if (changed) {
        currentSaved = false;
        message = '';
        void refreshSavedCount();
      }
      const initialWord = getLookupWord();
      if (initialWord && !initialLookupStarted) {
        initialLookupStarted = true;
        void lookupWord(initialWord, false).catch(() => {});
      }
    });
    const cleanupWebMcp = registerLookup(lookupWord);

    return () => {
      unregisterToolbar();
      cleanupAuth();
      cleanupWebMcp();
      suggestionController.cancel();
    };
  });
</script>

<svelte:window onpopstate={() => void restoreHistory()} />

<svelte:head>
  <title>České pády</title>
</svelte:head>

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
  onSubmit={(searchWord) => void lookupWord(searchWord).catch(() => {})}
/>

{#if error}<p class="notice notice-error" role="alert">{error}</p>{/if}

{#if result}
  <LookupResult
    {result}
    {busy}
    {saving}
    signedIn={Boolean(auth.session)}
    {currentSaved}
    {message}
    onToggleSaved={() => void toggleCurrentWordSaved()}
    onSuggestion={(suggestion) => void lookupWord(suggestion).catch(() => {})}
  />
{:else}
  <LookupEmptyState />
{/if}
<SiteFooter />
