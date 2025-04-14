<script lang="ts">
  import type { Column } from "./Column";

  let { children, title, column } = $props<{
    children?: any;
    column?: Column;
    title?: string;
  }>();

  function getTextAlignStyles(align?: "left" | "center" | "right") {
    return align ? `text-${align}` : "";
  }
</script>

<td
  class={`border border-base-300 py-2 px-3 ${getTextAlignStyles(column?.align)}`}
  {title}
>
  {#if children}
    {@render children()}
  {/if}
</td>
