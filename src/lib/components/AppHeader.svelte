<script lang="ts">
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
  class="flex items-center justify-between border-b border-[#dbe3ee] bg-white px-[5vw] py-[22px]"
>
  <a
    class="flex items-center gap-3 text-[23px] tracking-[-0.6px] text-[#182c47] no-underline [&>svg]:text-[#4268bd]"
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
  {#if signedIn}
    <button class="btn btn-secondary" type="button" onclick={onLogout}>
      <Icon name="logout" size={16} /> Odhlásit se
    </button>
  {:else}
    <button
      class="btn btn-secondary"
      type="button"
      disabled={!authReady}
      onclick={onLogin}
    >
      <Icon name="lock" size={16} /> Přihlásit se
    </button>
  {/if}
</header>
