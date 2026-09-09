<script lang="ts">
  import { onMount } from 'svelte';
  import { pushState, replaceState } from '$app/navigation';
  import type { Session } from '@supabase/supabase-js';
  import AppHeader from '$lib/components/AppHeader.svelte';
  import LoginDialog from '$lib/components/LoginDialog.svelte';
  import LookupEmptyState from '$lib/components/LookupEmptyState.svelte';
  import LookupResult from '$lib/components/LookupResult.svelte';
  import SavedDictionary from '$lib/components/SavedDictionary.svelte';
  import SearchPanel from '$lib/components/SearchPanel.svelte';
  import StickyToolbar, {
    type ExportFormat,
    type View
  } from '$lib/components/StickyToolbar.svelte';
  import Icon from '$lib/Icon.svelte';
  import { SUPABASE_KEY, SUPABASE_URL } from '$lib/config';
  import { compareCzechWords, exportData } from '$lib/exports';
  import { suggest } from '$lib/suggestions';
  import { supabase } from '$lib/supabase';
  import { registerLookup } from '$lib/webmcp';
  import { type Gender, type Lookup, type Saved } from '$lib/types';

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
  let view = $state<View>('lookup');
  let gender = $state<'all' | Gender>('all');
  let requestId = $state(0);
  let suggestionTimer = $state<ReturnType<typeof setTimeout> | undefined>();

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
    const query = new URLSearchParams({ word: value, action });
    const response = await fetch(`${endpoint()}?${query}`, {
      headers: { apikey: SUPABASE_KEY },
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

  function updateSuggestions(): void {
    const local = suggest(
      word,
      saved.map((item) => item.word)
    );
    suggestions = local;
    if (suggestionTimer) clearTimeout(suggestionTimer);
    if (word.trim().length < 3) return;

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
      }
    } catch {
      savedError =
        'Slovník nelze načíst. Zkontrolujte připojení a nastavení Supabase.';
    } finally {
      savedBusy = false;
    }
  }

  async function check(value = word): Promise<Lookup> {
    if (!value.trim()) throw new Error('Zadejte slovo.');

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
      const activeSession = session;
      if (!activeSession) return data;

      const response = await supabase.from('czech_words').upsert(
        {
          word: data.word,
          result: data,
          user_id: activeSession.user.id,
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
    if (!result) return;
    if (!session) {
      loginOpen = true;
      return;
    }
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
    replaceState(currentUrl, { view: 'saved' });
    currentUrl.searchParams.set('slovo', row.word);
    pushState(currentUrl, { view: 'lookup', word: row.word });
    showSaved(row);
  }

  function selectView(nextView: View): void {
    if (nextView === 'saved') {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.has('slovo')) {
        currentUrl.searchParams.delete('slovo');
        pushState(currentUrl, { view: 'saved' });
      }
    }
    view = nextView;
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

  async function signOut(): Promise<void> {
    const response = await supabase.auth.signOut();
    if (response.error) error = 'Odhlášení se nezdařilo. Zkuste to znovu.';
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

<AppHeader
  signedIn={Boolean(session)}
  {authReady}
  onLogin={() => (loginOpen = true)}
  onLogout={signOut}
/>

<main
  class="mx-auto max-w-[1200px] px-7 pt-12 pb-16 max-[700px]:px-[18px] max-[700px]:pt-[30px] max-[700px]:pb-[55px]"
>
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
  <h1
    class="mt-[9px] text-[38px] leading-[1.2] tracking-[-1.5px] max-[700px]:text-[30px]"
  >
    Čeština ve všech pádech.
  </h1>
  <p class="mt-0.5 mb-[22px] text-[#52647c]">
    Vyhledejte podstatné jméno a uložte si jeho tvary.
  </p>

  <SearchPanel
    bind:word
    {suggestions}
    {busy}
    onInput={updateSuggestions}
    onSubmit={() => void check().catch(() => {})}
  />

  {#if error}<p class="notice notice-error" role="alert">{error}</p>{/if}

  {#if view === 'lookup'}
    {#if result}
      <LookupResult
        {result}
        {busy}
        {saving}
        signedIn={Boolean(session)}
        {currentSaved}
        {message}
        onToggleSaved={() => void toggleSaved()}
      />
    {:else}
      <LookupEmptyState />
    {/if}
  {:else}
    <SavedDictionary
      email={session?.user.email}
      busy={savedBusy}
      error={savedError}
      rows={visibleSaved}
      {gender}
      onGender={(nextGender) => (gender = nextGender)}
      onRefresh={() => void refresh()}
      onOpen={openSaved}
    />
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
  <LoginDialog
    bind:email
    bind:password
    busy={authBusy}
    error={authError}
    onClose={() => (loginOpen = false)}
    onSubmit={signIn}
  />
{/if}
