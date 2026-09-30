<script lang="ts">
  import { page } from '$app/state';
  import { AppShellState, setAppShell, type View } from '$lib/app-shell.svelte';
  import AppHeader from '$lib/components/AppHeader.svelte';
  import LoginDialog from '$lib/components/LoginDialog.svelte';
  import StickyToolbar from '$lib/components/StickyToolbar.svelte';
  import {
    openLookupHome,
    openPatterns,
    openSavedDictionary
  } from '$lib/lookup-history';
  import { createPageAuth } from '$lib/page-auth.svelte';
  import { onMount } from 'svelte';
  import '../remixicon.css';
  import '../app.css';

  let { children } = $props();

  const auth = createPageAuth();
  const shell = new AppShellState();
  setAppShell(shell);
  shell.registerLoginHandler(() => (auth.loginOpen = true));

  let logoutError = $state('');
  const view = $derived.by<View>(() => {
    if (page.url.pathname.endsWith('/slovnik')) return 'saved';
    if (page.url.pathname.endsWith('/vzory')) return 'patterns';
    return 'lookup';
  });

  function selectView(nextView: View): void {
    if (nextView === view) return;
    if (nextView === 'lookup') void openLookupHome();
    if (nextView === 'saved') void openSavedDictionary();
    if (nextView === 'patterns') void openPatterns();
  }

  async function signOut(): Promise<void> {
    logoutError = '';
    if (!(await auth.signOut())) {
      logoutError = 'Odhlášení se nezdařilo. Zkuste to znovu.';
    }
  }

  onMount(() => auth.initialize(() => {}));
</script>

<AppHeader
  signedIn={Boolean(auth.session)}
  authReady={auth.ready}
  onLogin={shell.openLogin.bind(shell)}
  onLogout={signOut}
/>

<main class="mx-auto max-w-300 px-3 pt-6 pb-16 sm:px-4 sm:pb-14 lg:px-8">
  <StickyToolbar
    {view}
    savedCount={shell.toolbar.savedCount}
    exportDisabled={shell.toolbar.exportDisabled}
    onView={selectView}
    onExport={shell.toolbar.onExport}
  />

  {#if logoutError}
    <p class="notice notice-error" role="alert">{logoutError}</p>
  {/if}

  {@render children()}
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
