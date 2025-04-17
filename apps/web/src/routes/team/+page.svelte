<script>
  import FormPage from "./form.svelte";
  import TeamPage from "../teams/[id]/page.svelte";
  import authState from "$lib/state/auth.svelte";
  import { onMount } from "svelte";

  let isLoading = $state(true);
  onMount(() => {
    setTimeout(() => (isLoading = false), 250);
  });
</script>

{#if isLoading}
  <div class="flex flex-col items-center gap-4 mt-16">
    <div class="loading loading-spinner loading-lg text-primary"></div>
    <p class="text-center">Loading...</p>
  </div>
{:else if authState.user?.team_id}
  <TeamPage teamId={authState.user?.team_id} />
{:else}
  <FormPage />
{/if}
