<script lang="ts">
  import AppHeader from '$lib/components/AppHeader.svelte';
  import DeclensionPatterns from '$lib/components/DeclensionPatterns.svelte';
  import LoginDialog from '$lib/components/LoginDialog.svelte';
  import SiteFooter from '$lib/components/SiteFooter.svelte';
  import StickyToolbar, {
    type ExportFormat,
    type View
  } from '$lib/components/StickyToolbar.svelte';
  import { exportData } from '$lib/exports';
  import {
    openLookupHome,
    openSavedDictionary,
    openSavedWord
  } from '$lib/lookup-history';
  import { createPageAuth } from '$lib/page-auth.svelte';
  import { canonicalPatternLookups } from '$lib/pattern-examples';
  import { loadSavedWords } from '$lib/saved-words';
  import type { Saved } from '$lib/types';
  import { onMount } from 'svelte';

  const auth = createPageAuth();
  const view: View = 'patterns';
  let saved = $state.raw<Saved[]>([]);
  let busy = $state(false);
  let error = $state('');
  let exporting = $state(false);

  async function loadExamples(): Promise<void> {
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
      error = 'Příklady ze slovníku se nepodařilo načíst.';
    } finally {
      busy = false;
    }
  }

  function selectView(nextView: View): void {
    if (nextView === 'lookup') void openLookupHome();
    if (nextView === 'saved') void openSavedDictionary();
  }

  async function runExport(format: ExportFormat): Promise<void> {
    exporting = true;
    error = '';
    try {
      await exportData(format, canonicalPatternLookups());
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Export se nezdařil.';
    } finally {
      exporting = false;
    }
  }

  onMount(() => {
    return auth.initialize((_session, changed) => {
      if (changed) void loadExamples();
    });
  });
</script>

<svelte:head>
  <title>Vzory · České pády</title>
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
    savedCount={auth.session ? saved.length : undefined}
    exportDisabled={exporting}
    onView={selectView}
    onExport={(format) => void runExport(format)}
  />

  <div class="eyebrow">ČESKÉ SKLOŇOVÁNÍ</div>
  <h1 class="mt-2 text-3xl leading-[1.2] tracking-[-1.5px] sm:text-4xl">
    Vzory podstatných jmen.
  </h1>
  <p class="mt-1 mb-6 text-neutral-500">
    Všech 14 vzorů přehledně podle rodu.
  </p>

  <DeclensionPatterns
    {saved}
    signedIn={Boolean(auth.session)}
    {busy}
    {error}
    onLogin={() => (auth.loginOpen = true)}
    onRefresh={() => void loadExamples()}
    onOpen={(word) => void openSavedWord(word)}
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
