<script>
  import FormPage from "./form.svelte";
  import TeamPage from "../teams/[id]/page.svelte";
  import authState from "$lib/state/auth.svelte";
  import { onMount } from "svelte";

  let isLoading = $state(true);
  let forceForm = $state(false);
  onMount(() => {
    forceForm = !authState.user?.team_id;
    setTimeout(() => (isLoading = false), 400);
  });
</script>

{#if isLoading}
  <div class="flex flex-col items-center gap-4 mt-16">
    <div class="loading loading-spinner loading-lg text-primary"></div>
    <p class="text-center">Loading...</p>
  </div>
{:else if authState.user?.team_id && !forceForm}
  <TeamPage teamId={authState.user?.team_id} />
{:else}
  <FormPage />
{/if}
