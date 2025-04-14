<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import type { Column } from "./Column";
  let {
    columns,
    cell,
    border,
  }: {
    columns: Column[];
    cell: Snippet<[Column]>;
    border?: "regular" | "thick";
  } = $props();
</script>

<tr
  class="bg-base-100 hover:bg-base-300/30 {border === 'thick' &&
    'border-y-2 border-base-400'}"
>
  {#each columns as column}
    {@render cell(column)}
  {/each}
</tr>
