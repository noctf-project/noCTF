<script lang="ts">
  import TeamPage from "$lib/components/TeamPage.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
</script>

<TeamPage teamId={data.teamId} />
