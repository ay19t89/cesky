<script lang="ts">
  import { resolve } from '$app/paths';
  import Icon from '$lib/Icon.svelte';

  let {
    signedIn,
    authReady,
    onLogin,
    onLogout
  }: {
    signedIn: boolean;
    authReady: boolean;
    onLogin: () => void;
    onLogout: () => void | Promise<void>;
  } = $props();
</script>

<header
  class="flex items-center justify-between border-b border-[#dbe3ee] bg-white px-[5vw] py-6"
>
  <a
    class="flex items-center gap-3 text-[23px] tracking-[-0.6px] text-[#182c47] no-underline [&>i]:text-[#4268bd]"
    href={resolve('/')}
    aria-label="České pády – úvod"
  >
    <Icon name="book-open-line" />
    <b>české pády</b>
    <span
      class="ml-4 border-l border-[#dbe3ee] pl-6 text-xs font-bold tracking-[1.6px] text-[#6a7a91] max-sm:hidden"
    >
      OSOBNÍ SLOVNÍK</span
    >
  </a>
  {#if signedIn}
    <button class="btn btn-secondary" type="button" onclick={onLogout}>
      <Icon name="logout-box-r-line" />
      Odhlásit se
    </button>
  {:else}
    <button
      class="btn btn-secondary"
      type="button"
      disabled={!authReady}
      onclick={onLogin}
    >
      <Icon name="lock-line" />
      Přihlásit se
    </button>
  {/if}
</header>
