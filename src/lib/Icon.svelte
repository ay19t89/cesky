<script lang="ts">
  let {
    name,
    bigIcon = false,
  }: {
    name: string;
    bigIcon?: boolean;
  } = $props();

  const sizeClass = $derived(bigIcon ? 'size-12' : 'size-5');
</script>

<i class={`ri-${name} ${sizeClass}`} aria-hidden="true"></i>
