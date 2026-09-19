<script lang="ts">
  let {
    email = $bindable(),
    password = $bindable(),
    busy,
    error,
    onClose,
    onSubmit
  }: {
    email: string;
    password: string;
    busy: boolean;
    error: string;
    onClose: () => void;
    onSubmit: (event: SubmitEvent) => void;
  } = $props();
</script>

<div
  class="fixed inset-0 z-50 grid place-items-center bg-[#10203980] p-5"
  role="presentation"
  onclick={onClose}
>
  <dialog
    class="relative m-0 w-full max-w-110 rounded-xl border-0 bg-white p-6 text-[#182c47] shadow-[0_24px_80px_#1020393b]"
    open
    aria-labelledby="login-title"
    onclick={(event) => event.stopPropagation()}
  >
    <button
      class="absolute top-3 right-3 h-9 w-9 bg-transparent p-0 text-2xl text-neutral-500 hover:text-neutral-700"
      type="button"
      aria-label="Zavřít"
      onclick={onClose}
    >
      ×
    </button>
    <h2
      id="login-title"
      class="text-2xl tracking-[-0.5px] font-semibold justify-center flex gap-2 mt-2"
    >
      Přihlášení do slovníku
    </h2>
    <p class="text-[#64758c] my-2">
      Každý účet vidí pouze vlastní uložená slova.
    </p>

    <form class="flex flex-col gap-2" onsubmit={onSubmit}>
      <label class="text-sm font-semibold" for="email">E-mail</label>
      <input
        class="rounded-lg border border-neutral-200 p-3"
        id="email"
        type="email"
        bind:value={email}
        autocomplete="email"
        required
      />
      <label class="text-sm font-semibold" for="password">Heslo</label>
      <input
        class="rounded-lg border border-neutral-200 p-3"
        id="password"
        type="password"
        bind:value={password}
        autocomplete="current-password"
        required
      />
      {#if error}
        <p class="notice notice-error" role="alert">{error}</p>
      {/if}
      <button class="btn my-2" type="submit" disabled={busy}>
        {busy ? 'Přihlašuji…' : 'Přihlásit se'}
      </button>
    </form>
  </dialog>
</div>
