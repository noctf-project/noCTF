<script lang="ts">
  import StatsPage from "$lib/components/stats/page.svelte";
  import { goto } from "$app/navigation";
  import { IS_STATIC_EXPORT } from "$lib/static_export/middleware";

  if (!IS_STATIC_EXPORT) {
    goto("/");
  }
</script>

<StatsPage canRefresh={false} />
