<script lang="ts">
  import Icon from "@iconify/svelte";
  import Graph, {
    type TeamChartData,
  } from "$lib/components/scoreboard/Graph.svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import TeamService from "$lib/state/team.svelte";
  import { getCategoriesFromTags } from "$lib/utils/challenges";
  import { getRelativeTime } from "$lib/utils/time";
  import teamScoresState from "$lib/state/team_solves.svelte";
  import { untrack } from "svelte";

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

  const TEAMS_PER_PAGE = 25;
  let currentPage = $state(0);
  let detailedView = $state(false);

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

  const allTeamsScoreboard: Map<number, ScoreboardEntry> = $derived(
    new Map(
      apiScoreboard.r?.data?.data
        .toSorted(
          (a, b) =>
            b.score - a.score ||
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .map((s, i) => [
          s.team_id,
          {
            ...s,
            rank: i + 1,
            timestamp: new Date(s.timestamp),
          },
        ]) || [],
    ),
  );

  const allTeamIds = $derived(Array.from(allTeamsScoreboard.keys()));
  const top10TeamIds = $derived(Array.from(allTeamIds).slice(0, 10));
  const paginatedTeamIds = $derived(
    Array.from(allTeamIds).slice(
      currentPage * TEAMS_PER_PAGE,
      (currentPage + 1) * TEAMS_PER_PAGE,
    ),
  );

  const totalPages = $derived(Math.ceil(allTeamIds.length / TEAMS_PER_PAGE));

  $effect(() => {
    if (detailedView && paginatedTeamIds.length) {
      untrack(() => {
        teamScoresState.loadTeams(paginatedTeamIds);
      });
    }
  });

  const teamSolveMap = $derived.by(() => {
    if (!detailedView) return new Map();

    const map = new Map();
    paginatedTeamIds.forEach((teamId) => {
      const teamData = teamScoresState.data.get(teamId);
      if (teamData) {
        const solveSet = new Set();
        teamData.solves.forEach((solve) => {
          solveSet.add(solve.challenge_id);
        });
        map.set(teamId, solveSet);
      }
    });
    return map;
  });

  let top10TeamsChartDataLoaded = $state(false);
  let top10TeamsChartsData: TeamChartData[] = $state([]);
  $effect(() => {
    if (top10TeamsChartDataLoaded) {
      return;
    }

    (async () => {
      if (!top10TeamIds.length) return;

      const { loading, data } = teamScoresState;
      const top10TeamScores = top10TeamIds.map((id) => ({
        loading: !!loading.get(id),
        data: data.get(id),
      }));

      const allTeamScoresLoaded = top10TeamIds.every(
        (_, i) =>
          top10TeamScores[i] &&
          !top10TeamScores[i].loading &&
          top10TeamScores[i].data,
      );
      if (!allTeamScoresLoaded) return;

      let teamNames;
      try {
        teamNames = await Promise.all(
          top10TeamIds.map((id) => TeamService.getTeamName(id)),
        );
      } catch {
        return;
      }

      if (teamNames.some((name) => name == null)) return;

      const chartData = top10TeamIds.map((_, i) => ({
        name: teamNames[i]!,
        data: top10TeamScores[i]!.data!.graph || [],
      }));

      top10TeamsChartDataLoaded = true;
      top10TeamsChartsData = chartData;
    })();
  });

  $effect(() => {
    if (top10TeamIds.length) {
      untrack(() => {
        teamScoresState.loadTeams(top10TeamIds);
      });
    }
  });

  function goToNextPage() {
    if (currentPage < totalPages - 1) {
      currentPage++;
    }
  }

  function goToPrevPage() {
    if (currentPage > 0) {
      currentPage--;
    }
  }

  function goToPage(page: number) {
    if (page >= 0 && page < totalPages) {
      currentPage = page;
    }
  }

  function toggleView() {
    detailedView = !detailedView;

    setTimeout(() => {
      if (detailedView && paginatedTeamIds.length) {
        teamScoresState.loadTeams(paginatedTeamIds);
      }
    }, 0);
  }
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
        {#if top10TeamsChartDataLoaded && top10TeamsChartsData.length}
          <Graph data={top10TeamsChartsData} />
        {:else}
          <div class="skeleton w-full h-[33rem]"></div>
        {/if}
      </div>

      {#if detailedView}

        <!-- Detailed table view -->
        <div class="mt-4 mb-4">
          <button
            class="btn btn-sm btn-primary gap-2 pop hover:pop"
            onclick={toggleView}
          >
            <Icon icon="material-symbols:view-agenda-outline" class="text-lg" />
            Compact View
          </button>
        </div>

        <div class="flex flex-row gap-0 w-auto ml-[37rem] -mt-16">
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
              <th class="border border-base-300 bg-base-200 px-2 py-1 w-12"
                >#</th
              >
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
            {#each paginatedTeamIds as team_id (`row-${team_id}`)}
              {@const entry = allTeamsScoreboard.get(team_id)!}
              {@const teamData = teamScoresState.data.get(team_id)}
              {#if !teamData}
                <tr>
                  <td class="border border-base-300 text-center h-12">
                    <div class="skeleton h-4 w-6 mx-auto"></div>
                  </td>

                  <td class="border border-base-300 px-4">
                    <div class="skeleton h-4 w-32"></div>
                  </td>

                  <td class="border border-base-300 px-4 text-center">
                    <div class="skeleton h-4 w-8 mx-auto"></div>
                  </td>

                  <td class="border border-base-300 px-4 text-center">
                    <div class="skeleton h-4 w-6 mx-auto"></div>
                  </td>

                  <td class="border border-base-300 px-4 text-center">
                    <div class="skeleton h-4 w-16 mx-auto"></div>
                  </td>

                  {#each challenges as challenge (`chall-${entry.team_id}-${challenge.id}`)}
                    <td class="border border-base-300 p-0">
                      <div
                        class="w-full h-full flex flex-col items-center justify-center py-2"
                      >
                        <div class="skeleton h-3 w-6"></div>
                      </div>
                    </td>
                  {/each}
                </tr>
              {:else}
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
                        <div class="skeleton h-4 w-24"></div>
                      {:then name}
                        {name}
                      {/await}
                    </a>
                  </td>
                  <td class="border border-base-300 px-4 text-center">
                    {entry.score}
                  </td>
                  <td class="border border-base-300 px-4 text-center">
                    {teamData.solves.length || 0}
                  </td>
                  <td
                    class="border border-base-300 px-4 text-center"
                    title={entry.timestamp.toLocaleString()}
                  >
                    {getRelativeTime(entry.timestamp)}
                  </td>
                  {#each challenges as challenge (`chall-${entry.team_id}-${challenge.id}`)}
                    {@const solved =
                      teamSolveMap.get(team_id)?.has(challenge.id) ?? false}
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
                          class="text-xl {solved
                            ? 'text-primary'
                            : 'opacity-10'}"
                        />
                        <span
                          class="text-xs {solved
                            ? 'text-primary'
                            : 'opacity-20'}">{challenge.points}</span
                        >
                      </div>
                    </td>
                  {/each}
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      {:else}

        <!-- Compact View Table -->
        <div class="md:w-2/3 mx-auto w-full">
          <div class="mt-4 mb-4">
            <button
              class="btn btn-sm btn-primary gap-2 pop hover:pop"
              onclick={toggleView}
            >
              <Icon icon="material-symbols:grid-view" class="text-lg" />
              Detailed View
            </button>
          </div>

          <table class="border-collapse w-full overflow-auto table-fixed">
            <thead>
              <tr>
                <th class="border border-base-300 bg-base-200 px-2 py-1 w-12"
                  >#</th
                >
                <th
                  class="border border-base-300 bg-base-200 px-4 py-1 text-center"
                  >Team</th
                >
                <th class="border border-base-300 bg-base-200 px-2 py-1 w-20"
                  >Score</th
                >
                <th class="border border-base-300 bg-base-200 px-2 py-1 w-32"
                  >Last Solve</th
                >
              </tr>
            </thead>
            <tbody>
              {#each paginatedTeamIds as team_id (`compact-row-${team_id}`)}
                {@const entry = allTeamsScoreboard.get(team_id)!}
                <tr>
                  <td class="border border-base-300 text-center h-12 font-bold">
                    {entry.rank}
                  </td>
                  <td class="border border-base-300 px-4 text-center">
                    <a
                      href="/team/{entry.team_id}"
                      class="truncate block cursor-pointer"
                    >
                      {#await TeamService.getTeamName(entry.team_id)}
                        <div class="skeleton h-4 w-32 mx-auto"></div>
                      {:then name}
                        {name}
                      {/await}
                    </a>
                  </td>
                  <td class="border border-base-300 px-4 text-center">
                    {entry.score}
                  </td>
                  <td
                    class="border border-base-300 px-4 text-center"
                    title={entry.timestamp.toLocaleString()}
                  >
                    {getRelativeTime(entry.timestamp)}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      <div class="flex justify-center items-center mt-4 gap-2 mb-8">
        <button
          class="btn btn-sm pop hover:pop"
          disabled={currentPage === 0}
          onclick={goToPrevPage}
        >
          Previous
        </button>

        {#if totalPages <= 7}
          {#each Array(totalPages) as _, i}
            <button
              class="btn btn-sm hover:pop pop {i === currentPage
                ? 'btn-primary'
                : ''}"
              onclick={() => goToPage(i)}
            >
              {i + 1}
            </button>
          {/each}
        {:else}
          <button
            class="btn btn-sm hover:pop pop {currentPage === 0
              ? 'btn-primary'
              : ''}"
            onclick={() => goToPage(0)}
          >
            1
          </button>

          {#if currentPage > 2}
            <span class="px-2">...</span>
          {/if}

          {#if currentPage <= 2}
            {#each [1, 2, 3] as i}
              <button
                class="btn btn-sm hover:pop pop {i === currentPage
                  ? 'btn-primary'
                  : ''}"
                onclick={() => goToPage(i)}
              >
                {i + 1}
              </button>
            {/each}
          {:else if currentPage >= totalPages - 3}
            {#each [totalPages - 4, totalPages - 3, totalPages - 2] as i}
              <button
                class="btn btn-sm hover:pop pop {i === currentPage
                  ? 'btn-primary'
                  : ''}"
                onclick={() => goToPage(i)}
              >
                {i + 1}
              </button>
            {/each}
          {:else}
            {#each [currentPage - 1, currentPage, currentPage + 1] as i}
              <button
                class="btn btn-sm hover:pop pop {i === currentPage
                  ? 'btn-primary'
                  : ''}"
                onclick={() => goToPage(i)}
              >
                {i + 1}
              </button>
            {/each}
          {/if}

          {#if currentPage < totalPages - 3}
            <span class="px-2">...</span>
          {/if}

          <button
            class="btn btn-sm hover:pop pop {currentPage === totalPages - 1
              ? 'btn-primary'
              : ''}"
            onclick={() => goToPage(totalPages - 1)}
          >
            {totalPages}
          </button>
        {/if}

        <button
          class="btn btn-sm pop hover:pop"
          disabled={currentPage === totalPages - 1}
          onclick={goToNextPage}
        >
          Next
        </button>

        <span class="ml-2 text-sm">
          Page {currentPage + 1} of {totalPages} ({allTeamIds.length} teams)
        </span>
      </div>
    </div>
  {/if}
</div>
