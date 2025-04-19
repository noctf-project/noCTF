<script lang="ts">
  import Page from "./page.svelte";
  import type { PageData } from "./$types";

  const props: { data: PageData } = $props();
  const teamId = props.data.teamId;
</script>

<Page {teamId} />
