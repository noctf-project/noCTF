<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import Graph from "$lib/components/scoreboard/Graph.svelte";
  import type { TeamChartData } from "$lib/components/scoreboard/Graph.svelte";
  import { toasts } from "$lib/stores/toast";
  import TeamService from "$lib/state/team.svelte";
  import teamScoresState, {
    type TeamScoringData,
  } from "$lib/state/team_solves.svelte";
  import { countryCodeToFlag } from "$lib/utils/country_flags";
  import type { Team } from "$lib/state/team.svelte";

  function getIfNotNullOrEmpty(
    str: string | undefined | null,
  ): string | undefined {
    if (str != null && str.length > 0) {
      return str;
    }
    return undefined;
  }

  let teamId = Number(page.params.id);
  let isLoading = $state(false);
  let team = $state<Team | undefined>();
  let teamScores = $state<TeamScoringData | undefined>();
  let teamName = $derived(getIfNotNullOrEmpty(team?.name));
  let country = $derived(getIfNotNullOrEmpty(team?.country));
  let bio = $derived(getIfNotNullOrEmpty(team?.bio));
  let graphData = $derived<TeamChartData | undefined>(
    teamScores != null && teamName != null
      ? {
          name: teamName,
          data: teamScores.graph,
        }
      : undefined,
  );

  $effect(() => console.log(team));
  $effect(() => console.log(teamScores));

  onMount(async () => {
    try {
      const res = await Promise.all([
        TeamService.getTeamById(teamId),
        teamScoresState.fetchTeam(teamId),
      ]);
      team = res[0];
      teamScores = teamScoresState.data.get(teamId);
    } catch (error) {
      console.error("Failed to load team: " + teamId, error);
      toasts.error("Failed to load team. Please try again later.");
    } finally {
      isLoading = false;
    }
  });
</script>

{#if !isLoading && team != null}
  <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
    <h1 class="text-4xl font-bold">{team.name}</h1>
    {#if country != null}
      <p class="text-lg">
        {countryCodeToFlag("au")}
        {country}
      </p>
    {/if}
    {#if bio != null}
      <p class="text-lg">
        Bio: {bio}
      </p>
    {/if}
    {#if graphData != null}
      <Graph data={[graphData]} />
    {/if}
  </div>
{/if}
