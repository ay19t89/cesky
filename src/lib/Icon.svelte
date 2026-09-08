<script lang="ts">
  export let name:
    | 'search'
    | 'book'
    | 'bookmark'
    | 'bookmark-check'
    | 'logout'
    | 'lock'
    | 'download'
    | 'refresh'
    | 'arrow-right'
    | 'arrow-up-right'
    | 'check'
    | 'loader';
  export let size = 18;
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  class:spin={name === 'loader'}
>
  {#if name === 'search'}
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  {:else if name === 'book'}
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path
      d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"
    />
  {:else if name === 'bookmark'}
    <path d="M6 3h12v18l-6-4-6 4V3Z" />
  {:else if name === 'bookmark-check'}
    <path d="M6 3h12v18l-6-4-6 4V3Z" /><path d="m9 9 2 2 4-4" />
  {:else if name === 'logout'}
    <path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path
      d="M21 19V5a2 2 0 0 0-2-2h-6"
    />
  {:else if name === 'lock'}
    <rect x="4" y="10" width="16" height="11" rx="2" /><path
      d="M8 10V7a4 4 0 0 1 8 0v3"
    />
  {:else if name === 'download'}
    <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
  {:else if name === 'refresh'}
    <path d="M20 6v6h-6" /><path d="M4 18v-6h6" /><path
      d="M18.5 9A7 7 0 0 0 6 6.5L4 12"
    /><path d="M5.5 15A7 7 0 0 0 18 17.5l2-5.5" />
  {:else if name === 'arrow-right'}
    <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
  {:else if name === 'arrow-up-right'}
    <path d="M7 17 17 7" /><path d="M7 7h10v10" />
  {:else if name === 'check'}
    <path d="m5 12 4 4L19 6" />
  {:else if name === 'loader'}
    <path d="M21 12a9 9 0 1 1-6.2-8.6" />
  {/if}
</svg>
