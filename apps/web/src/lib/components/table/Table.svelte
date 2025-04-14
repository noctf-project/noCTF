<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import type { Column } from "./Column";

  let {
    data,
    columns,
    row,
  }: {
    data: T[];
    columns: Column[];
    row: Snippet<[T, Column[]]>;
  } = $props();

  function getColumnExtraStyles(column: Column) {
    return [
      column.width ? `w-${column.width}` : undefined,
      column.maxWidth ? `max-w-${column.maxWidth}` : undefined,
      column.minWidth ? `min-w-${column.minWidth}` : undefined,
      column.textAlign ? `text-${column.textAlign}` : undefined,
    ]
      .filter((str) => str !== undefined)
      .join(" ");
  }
</script>

<div
  class="pop border border-base-500 bg-base-100 rounded-lg overflow-y-hidden overflow-x-auto"
>
  <table class="w-full border-collapse">
    <thead>
      <tr>
        {#each columns as column}
          <th
            class={`border border-base-300 bg-base-200 py-2 px-3 font-bold ${getColumnExtraStyles(column)}`}
          >
            {column.label}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each data as item}
        {@render row(item, columns)}
      {/each}
    </tbody>
  </table>
</div>
