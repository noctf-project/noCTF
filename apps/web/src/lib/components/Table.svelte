<script lang="ts">
  export let ariaLabel: string;
  export let columns: {
    header: string;
    width?: string;
    align?: "left" | "center" | "right";
  }[];
</script>

<div class="overflow-x-auto pop rounded-lg">
  <table
    class="table table-sm table-fixed bg-base-100 w-full"
    aria-label={ariaLabel}
  >
    <thead>
      <tr class="bg-base-300 border-b-2 border-base-400">
        {#each columns as column}
          <th
            scope="col"
            class="border-r-2 border-base-400 {column.align === 'center'
              ? 'text-center'
              : column.align === 'right'
                ? 'text-right'
                : 'text-left'}"
            style="width: {column.width ?? 'auto'}"
          >
            {column.header}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      <slot />
    </tbody>
  </table>
</div>
