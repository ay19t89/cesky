<script lang="ts">
  let {
    name,
    iconSize
  }: {
    name: string;
    iconSize?: number;
  } = $props();

  const sizeClass = $derived(
    iconSize === 12 ? 'size-12' : iconSize === 8 ? 'size-8' : 'size-5'
  );
</script>

<i class={`ri-${name} ${sizeClass}`} aria-hidden="true"></i>
