<script lang="ts">
  import Icon from "@iconify/svelte";
  import Graph from "$lib/components/scoreboard/Graph.svelte";
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
    timestamp: Date;
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
      .sort((a, b) => a.points - b.points) || [],
  );

  const scoreboard: ScoreboardEntry[] = $derived(
    apiScoreboard.r?.data?.data
      .toSorted(
        (a, b) =>
          b.score - a.score ||
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .map((s, i) => ({
        ...s,
        rank: i + 1,
        timestamp: new Date(s.timestamp),
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

  const top10TeamsChartData = $derived.by(async () => {
    const top10TeamIds = teamIds.slice(0, 10);
    if (!top10TeamIds.length) return { loading: true, data: [] };

    const allTeamScoresLoaded = top10TeamIds.every(
      (_, i) =>
        $teamScores[i] && !$teamScores[i].loading && $teamScores[i].data,
    );
    if (!allTeamScoresLoaded) return { loading: true, data: [] };

    let teamNames;
    try {
      teamNames = await Promise.all(
        top10TeamIds.map((id) => TeamService.getTeamName(id)),
      );
    } catch {
      return { loading: true, data: [] };
    }

    if (teamNames.some((name) => name == null))
      return { loading: true, data: [] };

    const chartData = top10TeamIds.map((_, i) => ({
      name: teamNames[i]!,
      data: $teamScores[i]!.data!.graph || [],
    }));

    return { loading: false, data: chartData };
  });
</script>

<div class="w-10/12 mx-auto mt-8 pb-4">
  {#if loading}
    <div class="flex flex-col items-center gap-4 mt-16">
      <div class="loading loading-spinner loading-lg text-primary"></div>
      <p class="text-center">Loading scoreboard...</p>
    </div>
  {:else}
    <div class="overflow-x-auto flex flex-col gap-0">
      <div class="mx-auto mt-8 2xl:w-2/3 w-full">
        {#await top10TeamsChartData then graphData}
          <Graph data={graphData.data} />
        {/await}
      </div>

      <div class="flex flex-row gap-0 w-auto ml-[36rem] -mt-16">
        {#each challenges as challenge}
          <div class="relative">
            <div
              class="
                  w-10
                  h-32
                  border
                  border-x-base-300
                  border-transparent
                  bg-base-200
                  skew-x-[-45deg]
                  translate-x-16
              "
            ></div>
            <div
              class="
                  absolute
                  bottom-14
                  left-1.5
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
        <thead>
          <tr>
            <th class="border border-base-300 bg-base-200 px-2 py-1 w-8">#</th>
            <th
              class="border border-base-300 bg-base-200 px-4 py-1 w-64 text-left"
              >Team</th
            >
            <th class="border border-base-300 bg-base-200 px-2 py-1 w-20"
              >Score</th
            >
            <th class="border border-base-300 bg-base-200 px-2 py-1 w-20"
              >Solves</th
            >
            <th class="border border-base-300 bg-base-200 px-2 py-1 w-32"
              >Last Solve</th
            >
            {#each challenges as challenge}
              <th
                class="border border-base-300 bg-base-200 w-10 text-center text-sm"
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
              <td class="border border-base-300 text-center h-12 font-bold">
                {entry.rank}
              </td>
              <td class="border border-base-300 px-4">
                <a
                  href="/team/{entry.team_id}"
                  class="truncate block cursor-pointer"
                >
                  {#await TeamService.getTeamName(entry.team_id)}
                    loading...
                  {:then name}
                    {name}
                  {/await}
                </a>
              </td>
              <td class="border border-base-300 px-4 text-center">
                {entry.score}
              </td>
              <td class="border border-base-300 px-4 text-center">
                {teamData?.data?.solves.length || 0}
              </td>
              <td
                class="border border-base-300 px-4 text-center"
                title={entry.timestamp.toLocaleString()}
              >
                {getRelativeTime(entry.timestamp)}
              </td>
              {#each challenges as challenge}
                {@const solved = teamData?.data?.solves.find(
                  ({ challenge_id }) => challenge_id === challenge.id,
                )}
                <td
                  class={"border border-base-300 p-0 " +
                    (solved ? "bg-primary/20" : "")}
                >
                  <div
                    class="w-full h-full flex flex-col items-center justify-center"
                    title={challenge.title}
                  >
                    <Icon
                      icon="material-symbols:flag"
                      class="text-xl {solved ? 'text-primary' : 'opacity-10'}"
                    />
                    <span
                      class="text-xs {solved ? 'text-primary' : 'opacity-20'}"
                      >{challenge.points}</span
                    >
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
