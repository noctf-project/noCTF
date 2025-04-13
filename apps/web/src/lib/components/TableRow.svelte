<script lang="ts">
  export let isHeader = false;
</script>

<tr
  class={isHeader
    ? "bg-base-300 border-b-2 border-base-400"
    : "border border-r border-base-300"}
>
  <slot />
</tr>
