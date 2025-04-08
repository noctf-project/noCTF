<script lang="ts">
  import Icon from "@iconify/svelte";
  import Graph, {
    type TeamChartData,
  } from "$lib/components/scoreboard/Graph.svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import TeamNamesService from "$lib/state/team_names.svelte";
  import { getCategoriesFromTags } from "$lib/utils/challenges";
  import { getRelativeTime } from "$lib/utils/time";
  import Pagination from "$lib/components/Pagination.svelte";
  import { countryCodeToFlag } from "$lib/utils/country_flags";

  type ScoreboardEntry = {
    team_id: number;
    rank: number;
    score: number;
    last_solve: Date;
    solves: {
      score: number;
      bonus?: number;
      created_at: Date;
      challenge_id: number;
    }[];
    awards: {
      value: number;
      created_at: Date;
    }[];
  };

  type ChallengeEntry = {
    id: number;
    title: string;
    points: number;
    categories: string[];
  };

  const TEAMS_PER_PAGE = 25;
  const DIVISION = 1;
  let currentPage = $state(0);
  let detailedView = $state(false);
  let totalTeams = $state(0);

  const apiChallenges = wrapLoadable(api.GET("/challenges"));
  const apiScoreboard = $derived(
    wrapLoadable(
      api.GET("/scoreboard/divisions/{id}", {
        params: {
          path: { id: DIVISION },
          query: { page: currentPage + 1, page_size: TEAMS_PER_PAGE },
        },
      }),
    ),
  );
  let initialLoadComplete = $state(false);
  const loading = $derived(
    (apiChallenges.loading || apiScoreboard.loading) && !initialLoadComplete,
  );

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

  const currentPageTeams: Map<number, ScoreboardEntry> = $derived(
    new Map(
      apiScoreboard.r?.data?.data?.scores.map((s, i) => [
        s.team_id,
        {
          ...s,
          rank: currentPage * TEAMS_PER_PAGE + (i + 1),
          last_solve: new Date(s.last_solve),
          solves: s.solves.map(({ created_at, ...rest }) => ({
            ...rest,
            created_at: new Date(created_at),
          })),
          awards: s.awards.map(({ created_at, ...rest }) => ({
            ...rest,
            created_at: new Date(created_at),
          })),
        },
      ]) || [],
    ),
  );

  $effect(() => {
    if (apiScoreboard.r?.data?.data?.total !== undefined) {
      totalTeams = apiScoreboard.r.data.data.total;

      if (!initialLoadComplete) {
        initialLoadComplete = true;
      }
    }
  });

  const paginatedTeamIds = $derived(Array.from(currentPageTeams.keys()));
  const totalPages = $derived(Math.ceil(totalTeams / TEAMS_PER_PAGE));

  const apiTop10TeamsChartsData = wrapLoadable(
    api.GET("/scoreboard/divisions/{id}/top", {
      params: { path: { id: DIVISION } },
    }),
  );
  let top10TeamsChartsData: Promise<TeamChartData[]> | undefined = $derived(
    apiTop10TeamsChartsData.r?.data
      ? Promise.all(
          apiTop10TeamsChartsData.r?.data.data.map(
            async ({ team_id, graph }) => ({
              name: await TeamNamesService.get(team_id),
              data: graph,
            }),
          ),
        )
      : undefined,
  );
  $effect(() => {});

  function toggleView() {
    detailedView = !detailedView;
  }
</script>

<div class="w-10/12 mx-auto mt-8 pb-4">
  {#if loading}
    <div class="flex flex-col items-center gap-4 mt-16">
      <div class="loading loading-spinner loading-lg text-primary"></div>
      <p class="text-center">Loading scoreboard...</p>
    </div>
  {:else if apiScoreboard.loading}
    <div class="flex flex-col gap-0">
      <div class="mx-auto mt-8 2xl:w-2/3 w-full">
        {#if top10TeamsChartsData}
          {#await top10TeamsChartsData then top10TeamsChartsData}
            <Graph data={top10TeamsChartsData} />
          {/await}
        {:else}
          <div class="skeleton w-full h-[33rem] mb-32"></div>
        {/if}
      </div>

      <div class="overflow-x-auto flex flex-col gap-0">
        {#if detailedView}
          <div class="mt-4 mb-4">
            <button
              class="btn btn-sm btn-primary gap-2 pop hover:pop"
              onclick={toggleView}
            >
              <Icon
                icon="material-symbols:view-agenda-outline"
                class="text-lg"
              />
              Compact View
            </button>
          </div>

          <div class="flex flex-row gap-0 w-auto ml-[37rem]">
            {#each challenges as challenge}
              <div class="relative">
                <div
                  class="w-10 h-32 border border-x-base-300 border-transparent bg-base-200 skew-x-[-45deg] translate-x-16"
                ></div>
                <div
                  class="absolute bottom-14 left-1.5 px-1 -rotate-45 w-40 z-10 truncate"
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
              {#each Array(currentPage === totalPages - 1 ? totalTeams % TEAMS_PER_PAGE : TEAMS_PER_PAGE) as _}
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
                  {#each challenges as challenge}
                    <td class="border border-base-300 p-0">
                      <div
                        class="w-full h-full flex flex-col items-center justify-center"
                        title={challenge.title}
                      >
                        <Icon
                          icon="material-symbols:flag"
                          class="text-xl opacity-10"
                        />
                        <span class="text-xs opacity-20"
                          >{challenge.points}</span
                        >
                      </div>
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
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
                {#each Array(currentPage === totalPages - 1 ? totalTeams % TEAMS_PER_PAGE : TEAMS_PER_PAGE) as _}
                  <tr>
                    <td class="border border-base-300 text-center h-12">
                      <div class="skeleton h-4 w-6 mx-auto"></div>
                    </td>
                    <td class="border border-base-300 px-4 text-center">
                      <div class="skeleton h-4 w-32 mx-auto"></div>
                    </td>
                    <td class="border border-base-300 px-4 text-center">
                      <div class="skeleton h-4 w-8 mx-auto"></div>
                    </td>
                    <td class="border border-base-300 px-4 text-center">
                      <div class="skeleton h-4 w-16 mx-auto"></div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        <div class="flex justify-center items-center mt-4 gap-2 mb-8">
          <button class="btn btn-sm pop hover:pop" disabled>Previous</button>
          <div class="skeleton h-8 w-32 mx-2"></div>
          <button class="btn btn-sm pop hover:pop" disabled>Next</button>
          <span class="ml-2 text-sm skeleton h-4 w-40"></span>
        </div>
      </div>
    </div>
  {:else}
    <div class="flex flex-col gap-0">
      <div class="mx-auto mt-8 2xl:w-2/3 w-full">
        {#if top10TeamsChartsData}
          {#await top10TeamsChartsData then top10TeamsChartsData}
            <Graph data={top10TeamsChartsData} />
          {/await}
        {:else}
          <div class="skeleton w-full h-[33rem] mb-32"></div>
        {/if}
      </div>

      <div class="overflow-x-auto flex flex-col gap-0">
        {#if detailedView}
          <div class="mt-4 mb-4">
            <button
              class="btn btn-sm btn-primary gap-2 pop hover:pop"
              onclick={toggleView}
            >
              <Icon
                icon="material-symbols:view-agenda-outline"
                class="text-lg"
              />
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
                {@const entry = currentPageTeams.get(team_id)!}
                <tr>
                  <td class="border border-base-300 text-center h-12 font-bold">
                    {#if entry.rank <= 3}
                      {["🥇", "🥈", "🥉"][entry.rank - 1]}
                    {:else}
                      {entry.rank}
                    {/if}
                  </td>
                  <td class="border border-base-300 px-4">
                    <div class="flex flex-row gap-4">
                      <span class="text-xl">{countryCodeToFlag("un")}</span>
                      <a
                        href="/team/{entry.team_id}"
                        class="truncate block cursor-pointer bg-base-300/40 p-0.5 px-2 rounded-md"
                      >
                        {#await TeamNamesService.get(entry.team_id)}
                          <div class="skeleton h-4 w-32 mx-auto"></div>
                        {:then name}
                          {name}
                        {/await}
                      </a>
                    </div>
                  </td>
                  <td class="border border-base-300 px-4 text-center">
                    {entry.score}
                  </td>
                  <td class="border border-base-300 px-4 text-center">
                    {entry.solves.length || 0}
                  </td>
                  <td
                    class="border border-base-300 px-4 text-center"
                    title={entry.last_solve.toLocaleString()}
                  >
                    {getRelativeTime(entry.last_solve)}
                  </td>
                  {#each challenges as challenge (`chall-${entry.team_id}-${challenge.id}`)}
                    {@const solved =
                      entry.solves?.find(
                        ({ challenge_id }) => challenge.id === challenge_id,
                      ) ?? false}
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
                    class="border border-base-300 bg-base-200 px-4 py-1 text-left"
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
                  {@const entry = currentPageTeams.get(team_id)!}
                  <tr>
                    <td
                      class="border border-base-300 text-center h-12 font-bold"
                    >
                      {#if entry.rank <= 3}
                        {["🥇", "🥈", "🥉"][entry.rank - 1]}
                      {:else}
                        {entry.rank}
                      {/if}
                    </td>
                    <td class="border border-base-300 px-4">
                      <div class="flex flex-row gap-4">
                        <span class="text-xl">{countryCodeToFlag("un")}</span>
                        <a
                          href="/team/{entry.team_id}"
                          class="truncate block cursor-pointer bg-base-300/40 p-0.5 px-2 rounded-md"
                        >
                          {#await TeamNamesService.get(entry.team_id)}
                            <div class="skeleton h-4 w-32 mx-auto"></div>
                          {:then name}
                            {name}
                          {/await}
                        </a>
                      </div>
                    </td>
                    <td class="border border-base-300 px-4 text-center">
                      {entry.score}
                    </td>
                    <td
                      class="border border-base-300 px-4 text-center"
                      title={entry.last_solve.toLocaleString()}
                    >
                      {getRelativeTime(entry.last_solve)}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>

      <Pagination
        totalItems={totalTeams}
        initialPage={currentPage}
        itemsPerPage={TEAMS_PER_PAGE}
        onChange={(page) => (currentPage = page)}
        className="mt-4 mb-8"
      />
    </div>
  {/if}
</div>
