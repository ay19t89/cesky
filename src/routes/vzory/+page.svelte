<script lang="ts">
  import {
    getAppShell,
    type ExportFormat,
    type ToolbarRegistration
  } from '$lib/app-shell.svelte';
  import DeclensionPatterns from '$lib/components/DeclensionPatterns.svelte';
  import SiteFooter from '$lib/components/SiteFooter.svelte';
  import { exportData } from '$lib/exports';
  import { openSavedWord } from '$lib/lookup-history';
  import { createPageAuth } from '$lib/page-auth.svelte';
  import { canonicalPatternLookups } from '$lib/pattern-examples';
  import { loadSavedWords } from '$lib/saved-words';
  import type { Saved } from '$lib/types';
  import { onMount } from 'svelte';

  const auth = createPageAuth();
  const shell = getAppShell();
  let saved = $state.raw<Saved[]>([]);
  let busy = $state(false);
  let error = $state('');
  let exporting = $state(false);
  const toolbar: ToolbarRegistration = {
    get savedCount() {
      return saved.length;
    },
    get exportDisabled() {
      return exporting;
    },
    onExport: (format) => void runExport(format)
  };

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
    const unregisterToolbar = shell.registerToolbar(toolbar);
    const cleanupAuth = auth.initialize((_session, changed) => {
      if (changed) void loadExamples();
    });
    return () => {
      unregisterToolbar();
      cleanupAuth();
    };
  });
</script>

<svelte:head>
  <title>Vzory · České pády</title>
</svelte:head>

<div class="eyebrow">ČESKÉ SKLOŇOVÁNÍ</div>
<h1 class="mt-2 text-3xl leading-[1.2] tracking-[-1.5px] sm:text-4xl">
  Vzory podstatných jmen.
</h1>
<p class="mt-1 mb-6 text-neutral-500">Všech 14 vzorů přehledně podle rodu.</p>

<DeclensionPatterns
  {saved}
  signedIn={Boolean(auth.session)}
  {busy}
  {error}
  onLogin={shell.openLogin.bind(shell)}
  onRefresh={() => void loadExamples()}
  onOpen={(word) => void openSavedWord(word)}
/>
<SiteFooter />
