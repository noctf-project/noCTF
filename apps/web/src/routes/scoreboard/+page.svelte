<script lang="ts">
  import Icon from "@iconify/svelte";
  import Graph, {
    type TeamChartData,
  } from "$lib/components/scoreboard/Graph.svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import TeamQueryService from "$lib/state/team_query.svelte";
  import { getCategoriesFromTags } from "$lib/utils/challenges";
  import { getRelativeTime } from "$lib/utils/time";
  import Pagination from "$lib/components/Pagination.svelte";
  import { countryCodeToFlag } from "$lib/utils/country";
  import authState from "$lib/state/auth.svelte";

  type ScoreboardEntry = {
    team_id: number;
    rank?: number;
    score: number;
    last_solve?: Date;
    solves: {
      value: number;
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

  type TeamTag = {
    id: number;
    name: string;
    is_joinable: boolean;
  };

  const TEAMS_PER_PAGE = 25;
  let currentPage = $state(0);
  let detailedView = $state(false);
  let totalTeams = $state(0);
  let selectedTags = $state<number[]>([]);

  const apiChallenges = wrapLoadable(api.GET("/challenges"));

  const apiTeamTags = wrapLoadable(api.GET("/team_tags"));
  const division = $derived(authState.user?.division_id || 1);
  const apiScoreboard = $derived(
    wrapLoadable(
      api.GET("/scoreboard/divisions/{id}", {
        params: {
          path: { id: division },
          query: {
            page: currentPage + 1,
            page_size: TEAMS_PER_PAGE,
            tags: selectedTags.length > 0 ? selectedTags : undefined,
          },
        },
      }),
    ),
  );

  let initialLoadComplete = $state(false);
  const loading = $derived(
    (apiChallenges.loading || apiScoreboard.loading || apiTeamTags.loading) &&
      !initialLoadComplete,
  );

  const challenges: ChallengeEntry[] = $derived(
    apiChallenges.r?.data?.data.challenges
      .map((c) => ({
        id: c.id,
        title: c.title,
        points: c.value || 0,
        categories: getCategoriesFromTags(c.tags),
      }))
      .sort((a, b) => a.points - b.points) || [],
  );

  const teamTags: TeamTag[] = $derived(apiTeamTags.r?.data?.data?.tags || []);

  const apiTeams = $derived(
    apiScoreboard.r?.data?.data?.scores.map((s, i) => ({
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
    })) || [],
  );

  let isMyTeamInCurrentPage = $derived(
    !!authState.user?.team_id &&
      apiTeams.some((t) => t.team_id === authState.user!.team_id),
  );

  let apiMyTeam = $derived(
    authState.user?.team_id && !isMyTeamInCurrentPage
      ? wrapLoadable(
          api.GET("/scoreboard/teams/{id}", {
            params: {
              path: { id: authState.user.team_id },
              query: {
                tags: selectedTags.length > 0 ? selectedTags : undefined,
              },
            },
          }),
        )
      : undefined,
  );

  const myTeamEntry = $derived.by(() => {
    if (
      !apiMyTeam?.r?.data?.data &&
      authState.user?.team_id &&
      !isMyTeamInCurrentPage
    )
      return {
        team_id: authState.user.team_id,
        rank: undefined,
        score: 0,
        last_solve: undefined,
        solves: [],
        awards: [],
      };

    if (!apiMyTeam?.r?.data?.data) return null;

    const teamData = apiMyTeam.r.data.data;
    return {
      team_id: teamData.team_id,
      rank: teamData.rank,
      score: teamData.score,
      last_solve: new Date(teamData.last_solve),
      solves: teamData.solves.map(({ created_at, ...rest }) => ({
        ...rest,
        created_at: new Date(created_at),
      })),
      awards: teamData.awards.map(({ created_at, ...rest }) => ({
        ...rest,
        created_at: new Date(created_at),
      })),
    };
  });

  const allTeamsToDisplay = $derived.by(() => {
    if (!myTeamEntry || isMyTeamInCurrentPage) {
      return apiTeams;
    }

    return myTeamEntry.rank && myTeamEntry.rank < apiTeams[0]!.rank
      ? [myTeamEntry, ...apiTeams]
      : [...apiTeams, myTeamEntry];
  });

  const currentPageTeams: Map<number, ScoreboardEntry> = $derived(
    new Map(allTeamsToDisplay.map((team) => [team.team_id, team])),
  );

  $effect(() => {
    if (apiScoreboard.r?.data?.data?.total !== undefined) {
      totalTeams = apiScoreboard.r.data.data.total;

      if (!initialLoadComplete) {
        initialLoadComplete = true;
      }
    }
  });

  function toggleTagFilter(tagId: number) {
    if (selectedTags.includes(tagId)) {
      selectedTags = selectedTags.filter((id) => id !== tagId);
    } else {
      selectedTags = [...selectedTags, tagId];
    }
    currentPage = 0;
  }

  function clearTagFilters() {
    selectedTags = [];
    currentPage = 0;
  }

  const paginatedTeamIds = $derived(Array.from(currentPageTeams.keys()));
  const totalPages = $derived(Math.ceil(totalTeams / TEAMS_PER_PAGE));

  const apiTop10TeamsChartsData = $derived(
    wrapLoadable(
      api.GET("/scoreboard/divisions/{id}/top", {
        params: {
          path: { id: division },
          query: { tags: selectedTags.length > 0 ? selectedTags : undefined },
        },
      }),
    ),
  );

  let top10TeamsChartsData: Promise<TeamChartData[]> | undefined = $derived(
    apiTop10TeamsChartsData.r?.data
      ? Promise.all(
          apiTop10TeamsChartsData.r?.data.data.map(
            async ({ team_id, graph }) => ({
              name: (await TeamQueryService.get(team_id))?.name,
              data: graph,
            }),
          ),
        )
      : undefined,
  );

  function getLoadingRowCount() {
    return currentPage === totalPages - 1
      ? totalTeams % TEAMS_PER_PAGE || TEAMS_PER_PAGE
      : TEAMS_PER_PAGE;
  }
</script>

{#snippet teamName(team_id: number, isCompact = false)}
  {@const isMe = authState.user?.team_id === team_id}
  {@const nameBg = isMe
    ? "bg-primary/85"
    : "bg-base-300/30 hover:bg-base-300/50"}
  {@const nameFg = isMe ? "text-primary-content" : ""}

  <div class={`flex items-center gap-2 ${!isCompact ? "w-full" : ""}`}>
    <span class="text-xl flex-shrink-0">{countryCodeToFlag("un")}</span>
    <a
      href={`/teams/${team_id}`}
      class={`truncate block cursor-pointer ${nameBg} ${nameFg} p-0.5 px-2 rounded-md font-medium`}
    >
      {#await TeamQueryService.get(team_id)}
        <div class="skeleton h-4 w-32"></div>
      {:then team}
        {team?.name}
      {/await}
    </a>
  </div>
{/snippet}

{#snippet rankDisplay(rank?: number)}
  {#if rank === undefined}
    <span class="font-mono">-</span>
  {:else if rank <= 3}
    <span class="text-xl">{["🥇", "🥈", "🥉"][rank - 1]}</span>
  {:else}
    <span class="font-mono">{rank}</span>
  {/if}
{/snippet}

{#snippet challengeTitles()}
  <div class="flex ml-[37rem]">
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
{/snippet}

{#snippet challengeCell(team_id: number, challenge: ChallengeEntry)}
  {@const entry = currentPageTeams.get(team_id)!}
  {@const solved =
    entry.solves?.find(({ challenge_id }) => challenge.id === challenge_id) ??
    false}

  <td class="border border-base-300 p-0 relative group min-w-10 max-w-10 h-10">
    <div
      class={`absolute inset-0 ${solved ? "bg-primary/20" : ""} group-hover:bg-base-300/30`}
    ></div>
    <div
      class="relative w-full h-full flex flex-col items-center justify-center"
      title={challenge.title}
    >
      <Icon
        icon="material-symbols:flag"
        class={`text-lg ${solved ? "text-primary" : "opacity-20"}`}
      />
      <span
        class={`text-xs ${solved ? "text-primary" : "opacity-30"} font-medium`}
      >
        {challenge.points}
      </span>
    </div>
  </td>
{/snippet}

{#snippet scoreboardControls()}
  <div
    class="card pop bg-base-100 rounded-lg mb-2 z-20 {detailedView &&
      'flex mx-auto w-fit z-20'} h-fit"
  >
    <div class="card-body p-4">
      <div
        class="flex flex-col sm:flex-row sm:justify-between lg:flex-col items-center gap-4 mb-2"
      >
        <h3 class="card-title text-2xl flex items-center gap-2 sm:-mb-1">
          <Icon icon="material-symbols:leaderboard" class="text-xl" />
          <div>Scoreboard View</div>
        </h3>

        <div class="flex items-center gap-2">
          <div class="join">
            <button
              class={`btn btn-sm join-item ${!detailedView ? "btn-primary" : "btn-outline"} pop hover:pop gap-1`}
              onclick={() => (detailedView = false)}
            >
              <Icon icon="material-symbols:grid-view" class="text-lg" />
              <span>Compact</span>
            </button>
            <button
              class={`btn btn-sm join-item ${detailedView ? "btn-primary" : "btn-outline"} pop hover:pop gap-1`}
              onclick={() => (detailedView = true)}
            >
              <Icon
                icon="material-symbols:view-agenda-outline"
                class="text-lg"
              />
              <span>Detailed</span>
            </button>
          </div>

          {#if selectedTags.length > 0}
            <button
              class="btn btn-sm btn-ghost pop hover:pop"
              onclick={clearTagFilters}
              title="Clear all filters"
            >
              <Icon icon="material-symbols:filter-list-off" class="text-lg" />
              <span class="hidden sm:inline lg:hidden">Clear filters</span>
            </button>
          {/if}
        </div>
      </div>

      <div class="divider my-1"></div>

      <div>
        <h4 class="font-medium mb-2 flex items-center gap-2">
          <Icon icon="material-symbols:filter-list" class="text-lg" />
          Team Tags
        </h4>

        <div class="flex flex-wrap gap-2">
          {#if apiTeamTags.loading}
            {#each Array(3) as _}
              <div class="skeleton h-8 w-20"></div>
            {/each}
          {:else if teamTags.length === 0}
            <div class="text-sm opacity-70">No team tags available</div>
          {:else}
            {#each teamTags as tag}
              {@const isActive = selectedTags.includes(tag.id)}
              <button
                class={`btn btn-sm ${isActive ? "btn-primary" : "btn-outline bg-base-200"} pop hover:pop`}
                onclick={() => toggleTagFilter(tag.id)}
              >
                {#if isActive}
                  <Icon icon="material-symbols:check" class="text-sm" />
                {/if}
                {tag.name}
              </button>
            {/each}
          {/if}
        </div>

        {#if selectedTags.length > 0}
          <div class="text-xs opacity-70 mt-2">
            Showing teams with any of the selected tags
          </div>
        {/if}
      </div>
    </div>
  </div>
{/snippet}

{#snippet topGraph()}
  <div class="mx-auto mt-8 min-w-[98%] lg:min-w-[66rem] max-w-[66rem] mb-8">
    {#if top10TeamsChartsData}
      {#await top10TeamsChartsData then data}
        <Graph {data} extraClasses="h-[33rem]" />
      {/await}
    {:else}
      <div class="skeleton w-full h-[33rem] mb-8"></div>
    {/if}
  </div>
{/snippet}

{#snippet compactTable()}
  <div
    class="pop border border-base-500 bg-base-100 rounded-lg overflow-y-hidden overflow-x-auto h-full"
  >
    <table class="w-full border-collapse">
      <thead>
        <tr>
          <th
            class="border border-base-300 bg-base-200 py-2 px-3 text-center font-bold w-12"
            >#</th
          >
          <th
            class="border border-base-300 bg-base-200 py-2 px-3 text-left font-bold min-w-32 max-w-32 lg:w-auto"
            >Team</th
          >
          <th
            class="border border-base-300 bg-base-200 py-2 px-3 text-center font-bold w-20"
            >Score</th
          >
          <th
            class="border border-base-300 bg-base-200 py-2 px-3 text-center font-bold w-32"
            >Last Solve</th
          >
        </tr>
      </thead>
      <tbody>
        {#each paginatedTeamIds as team_id (`compact-row-${team_id}`)}
          {@const entry = currentPageTeams.get(team_id)!}
          {@const isMe = authState.user?.team_id === team_id}
          <tr
            class="bg-base-100 hover:bg-base-300/30 {isMe &&
              'border-y-2 border-base-400'}"
          >
            <td
              class="border border-base-300 py-2 px-3 text-center h-10 font-bold"
            >
              {@render rankDisplay(entry.rank)}
            </td>
            <td
              class="border border-base-300 py-2 px-3 min-w-32 max-w-32 lg:w-auto"
            >
              {@render teamName(entry.team_id, true)}
            </td>
            <td
              class="border border-base-300 py-2 px-3 text-center font-mono font-bold"
            >
              {entry.score}
            </td>
            <td
              class="border border-base-300 py-2 px-3 text-center"
              title={entry?.last_solve ? entry.last_solve.toLocaleString() : ""}
            >
              {entry.last_solve?.getTime()
                ? getRelativeTime(entry.last_solve)
                : "-"}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/snippet}

{#snippet loadingSkeletonTable(isDetailed = true)}
  <table
    class={`border-collapse ${isDetailed ? "w-80" : "w-full"} overflow-auto table-fixed`}
  >
    <thead>
      <tr>
        <th class="border border-base-300 bg-base-200 px-2 py-1 w-12">#</th>
        <th class="border border-base-300 bg-base-200 px-4 py-1 w-64 text-left"
          >Team</th
        >
        <th class="border border-base-300 bg-base-200 px-2 py-1 w-20">Score</th>
        {#if isDetailed}
          <th class="border border-base-300 bg-base-200 px-2 py-1 w-20"
            >Solves</th
          >
        {/if}
        <th class="border border-base-300 bg-base-200 px-2 py-1 w-32"
          >Last Solve</th
        >
        {#if isDetailed}
          {#each challenges as challenge}
            <th
              class="border border-base-300 bg-base-200 w-10 text-center text-sm"
            >
              {challenge.points}
            </th>
          {/each}
        {/if}
      </tr>
    </thead>
    <tbody>
      {#each Array(getLoadingRowCount()) as _}
        <tr>
          <td class="border border-base-300 text-center h-12">
            <div class="skeleton h-4 w-6 mx-auto"></div>
          </td>
          <td
            class="border border-base-300 px-4 {!isDetailed
              ? 'text-center'
              : ''}"
          >
            <div class="skeleton h-4 w-32 {!isDetailed ? 'mx-auto' : ''}"></div>
          </td>
          <td class="border border-base-300 px-4 text-center">
            <div class="skeleton h-4 w-8 mx-auto"></div>
          </td>
          {#if isDetailed}
            <td class="border border-base-300 px-4 text-center">
              <div class="skeleton h-4 w-6 mx-auto"></div>
            </td>
          {/if}
          <td class="border border-base-300 px-4 text-center">
            <div class="skeleton h-4 w-16 mx-auto"></div>
          </td>
          {#if isDetailed}
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
                  <span class="text-xs opacity-20">{challenge.points}</span>
                </div>
              </td>
            {/each}
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
{/snippet}

{#snippet loadingPagination()}
  <div class="flex justify-center items-center mt-4 gap-2 mb-8">
    <button class="btn btn-sm pop hover:pop" disabled>Previous</button>
    <div class="skeleton h-8 w-32 mx-2"></div>
    <button class="btn btn-sm pop hover:pop" disabled>Next</button>
    <span class="ml-2 text-sm skeleton h-4 w-40"></span>
  </div>
{/snippet}

<div
  class={detailedView
    ? "w-full mx-auto mt-8 pb-4"
    : "lg:w-10/12 w-11/12 mx-auto mt-8 pb-4"}
>
  <div class="text-center text-4xl font-black pb-2">Scoreboard</div>
  {#if loading}
    <div class="flex flex-col items-center gap-4 mt-16">
      <div class="loading loading-spinner loading-lg text-primary"></div>
      <p class="text-center">Loading scoreboard...</p>
    </div>
  {:else if apiScoreboard.loading}
    <div class="flex flex-col gap-0">
      {@render topGraph()}

      {#if detailedView}
        <div class="flex justify-center">
          {@render scoreboardControls()}
        </div>

        <div class="overflow-x-auto flex flex-col gap-0">
          {@render challengeTitles()}
          {@render loadingSkeletonTable(true)}
        </div>
      {:else}
        <div class="flex flex-col lg:flex-row lg:gap-6 lg:items-start">
          <div class="w-full lg:w-1/3 mb-6 lg:mb-0">
            {@render scoreboardControls()}
          </div>

          <div class="w-full lg:w-2/3">
            <div class="md:w-full mx-auto">
              {@render loadingSkeletonTable(false)}
            </div>
          </div>
        </div>
      {/if}

      {@render loadingPagination()}
    </div>
  {:else}
    <div class="flex flex-col gap-0">
      {@render topGraph()}

      {#if detailedView}
        <div class="flex justify-center">
          {@render scoreboardControls()}
        </div>

        <div class="relative flex flex-col -mt-32">
          <div class="overflow-x-auto">
            <div class="w-[24rem] h-32 sticky left-0 top-32 z-20"></div>
            {@render challengeTitles()}

            <table
              class="table-fixed border-collapse border-b-4 border-base-500"
            >
              <thead>
                <tr>
                  <th
                    class="border-y border-base-300 bg-base-200 py-2 px-3 text-center font-bold min-w-12 max-w-12 sticky left-0 z-10"
                    >#</th
                  >
                  <th
                    class="border-y border-base-300 bg-base-200 py-2 px-3 text-left font-bold min-w-64 max-w-64 sticky left-12 z-10"
                    >Team</th
                  >
                  <th
                    class="border-y border-base-300 bg-base-200 py-2 px-3 text-center font-bold min-w-20 max-w-20 sticky left-[19rem] z-10"
                    >Score</th
                  >
                  <th
                    class="border border-base-300 bg-base-200 py-2 px-3 text-center font-bold min-w-20 max-w-20"
                    >Solves</th
                  >
                  <th
                    class="border border-base-300 bg-base-200 py-2 px-3 text-center font-bold min-w-32 max-w-32"
                    >Last Solve</th
                  >
                  {#each challenges as challenge}
                    <th
                      class="border border-base-300 bg-base-200 py-2 px-1 text-center font-bold min-w-10 max-w-10 h-10 text-sm"
                    >
                      {challenge.points}
                    </th>
                  {/each}
                </tr>
              </thead>

              <tbody>
                {#each paginatedTeamIds as team_id (`row-${team_id}`)}
                  {@const entry = currentPageTeams.get(team_id)!}
                  {@const isMe = authState.user?.team_id === team_id}
                  <tr
                    class="bg-base-100 hover:bg-base-300/30 {isMe &&
                      'border-y-2 border-base-400'}"
                  >
                    <td
                      class="border-b border-base-300 py-2 px-3 text-center h-10 font-bold sticky left-0 z-10 bg-base-100 min-w-12 max-w-12"
                    >
                      {@render rankDisplay(entry.rank)}
                    </td>
                    <td
                      class="border-b border-base-300 py-2 px-3 sticky left-12 z-10 bg-base-100 min-w-64 max-w-64"
                    >
                      {@render teamName(entry.team_id)}
                    </td>
                    <td
                      class="border-b border-base-300 py-2 px-3 text-center font-mono font-bold sticky left-[19rem] z-10 bg-base-100 min-w-20 max-w-20"
                    >
                      <div
                        class="bg-base-300 w-[1px] h-full absolute right-0 top-0"
                      ></div>
                      {entry.score}
                    </td>
                    <td
                      class="border border-l-0 border-base-300 py-2 px-3 text-center font-mono min-w-20 max-w-20"
                    >
                      {entry.solves.length || 0}
                    </td>
                    <td
                      class="border border-base-300 py-2 px-3 text-center text-sm min-w-32 max-w-32"
                      title={entry?.last_solve
                        ? entry.last_solve.toLocaleString()
                        : ""}
                    >
                      {entry.last_solve?.getTime()
                        ? getRelativeTime(entry.last_solve)
                        : "-"}
                    </td>
                    {#each challenges as challenge (`chall-${entry.team_id}-${challenge.id}`)}
                      {@render challengeCell(entry.team_id, challenge)}
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {:else}
        <div class="flex flex-col lg:flex-row lg:gap-6 lg:items-stretch">
          <div class="w-full lg:w-1/3 mb-6 lg:mb-0">
            {@render scoreboardControls()}
          </div>

          <div class="w-full lg:w-2/3">
            {@render compactTable()}
          </div>
        </div>
      {/if}

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
