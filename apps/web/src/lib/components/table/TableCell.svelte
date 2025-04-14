<script lang="ts">
  import type { Column } from "./Column";

  let {
    children,
    title,
    column,
    weight,
  }: {
    children?: any;
    column?: Column;
    title?: string;
    weight?: "bold" | "normal";
  } = $props();

  function getTextAlignStyles(align?: "left" | "center" | "right") {
    return align ? `text-${align}` : "";
  }

  function getWeightStyles(weight?: "bold" | "normal") {
    return weight ? `font-${weight}` : "";
  }
</script>

<td
  class={`border border-base-300 py-2 px-3 ${getTextAlignStyles(column?.textAlign)} ${getWeightStyles(weight)}`}
  {title}
>
  {#if children}
    {@render children()}
  {/if}
</td>
