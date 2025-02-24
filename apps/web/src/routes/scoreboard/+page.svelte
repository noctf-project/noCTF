<script lang="ts">
  import Icon from "@iconify/svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import TeamService from "$lib/state/team.svelte";
  import { getCategoriesFromTags } from "$lib/utils/challenges";
  import { getRelativeTime } from "$lib/utils/time";
  import { teamScoresStore } from "$lib/state/team_solves.svelte";
  import { derived as storeDerived } from "svelte/store";

  type ScoreboardEntry = {
    team_id: number;
    rank: number;
    score: number;
    time: Date;
  };

  type ChallengeEntry = {
    id: number;
    title: string;
    points: number;
    categories: string[];
  };

  const apiChallenges = wrapLoadable(api.GET("/challenges"));
  const apiScoreboard = wrapLoadable(api.GET("/scoreboard"));
  const loading = $derived(apiChallenges.loading || apiScoreboard.loading);

  const challenges: ChallengeEntry[] = $derived(
    apiChallenges.r?.data?.data.challenges
      .map((c) => ({
        id: c.id,
        title: c.title,
        points: c.score!,
        categories: getCategoriesFromTags(c.tags),
      }))
      .sort((a, b) => b.points - a.points) || [],
  );

  const scoreboard: ScoreboardEntry[] = $derived(
    apiScoreboard.r?.data?.data.map((s, i) => ({
      ...s,
      rank: i + 1,
      time: new Date(s.time),
    })) || [],
  );
  const teamIds = $derived(scoreboard.map(({ team_id }) => team_id));
  const teamScores = storeDerived(teamScoresStore, ($teamScoresStore) => {
    teamScoresStore.loadTeams(teamIds);
    const { loading, data } = $teamScoresStore;
    return teamIds.map((id) => ({
      loading: !!loading.get(id),
      data: data.get(id),
    }));
  });
</script>

<div class="w-10/12 mx-auto py-4">
  <h1 class="text-3xl font-bold mb-6 text-center">Scoreboard</h1>

  {#if loading}
    <div class="flex flex-col items-center gap-4 mt-16">
      <div class="loading loading-spinner loading-lg text-primary"></div>
      <p class="text-center">Loading scoreboard...</p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <div class="flex flex-row gap-0 w-auto ml-[34.5rem]">
        {#each challenges as challenge}
          <div class="relative">
            <div
              class="
                  w-12
                  h-32
                  border
                  border-base-300
                  bg-base-200
                  skew-x-[-45deg]
                  translate-x-16
              "
            ></div>
            <div
              class="
                  absolute
                  bottom-14
                  left-3
                  px-1
                  -rotate-45
                  w-40
                  z-10
                  truncate
              "
              title={`${challenge.title} (${challenge.categories.join(", ")})`}
            >
              {challenge.title}
            </div>
          </div>
        {/each}
      </div>

      <table class="border-collapse w-80 overflow-auto table-fixed">
        <thead class="h-4">
          <tr>
            <th class="border border-base-300 bg-base-200 px-2 py-1 w-8">#</th>
            <th
              class="border border-base-300 bg-base-200 px-4 py-1 w-64 text-left"
              >Team</th
            >
            <th class="border border-base-300 bg-base-200 px-2 py-1 w-32"
              >Last Solve</th
            >
            <th class="border border-base-300 bg-base-200 px-2 py-1 w-20"
              >Score</th
            >
            <th class="border border-base-300 bg-base-200 px-2 py-1 w-14"
              >Solves</th
            >
            {#each challenges as challenge}
              <th
                class="border border-base-300 bg-base-200 w-12 text-center text-sm"
              >
                {challenge.points}
              </th>
            {/each}
          </tr>
        </thead>

        <tbody>
          {#each scoreboard as entry, index}
            {@const teamData = $teamScores[index]}
            <tr>
              <td class="border border-base-300 text-center h-12">
                {entry.rank}
              </td>
              <td class="border border-base-300 px-4">
                <a href="/team/{entry.team_id}" class="truncate block">
                  {#await TeamService.getTeamName(entry.team_id)}
                    loading...
                  {:then name}
                    {name}
                  {/await}
                </a>
              </td>
              <td
                class="border border-base-300 px-4 text-center"
                title={entry.time.toLocaleString()}
              >
                {getRelativeTime(entry.time)}
              </td>
              <td class="border border-base-300 px-4 text-center">
                {entry.score}
              </td>
              <td class="border border-base-300 px-4 text-center">
                {teamData?.data?.solves.length || 0}
              </td>
              {#each challenges as challenge}
                {@const solved = teamData?.data?.solves.find(
                  ({ challenge_id }) => challenge_id === challenge.id,
                )}
                <td
                  class={"border border-base-300 p-0 " +
                    (solved ? "bg-primary/20" : "")}
                >
                  <div class="w-full h-full flex items-center justify-center">
                    {#if solved}
                      <Icon
                        icon="material-symbols:flag"
                        class="text-primary text-3xl"
                      />
                    {/if}
                  </div>
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
