<script lang="ts">
  import Icon from "@iconify/svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import StatsOverview from "$lib/components/stats/StatsOverview.svelte";
  import ChallengeStatsTable from "$lib/components/stats/ChallengeStatsTable.svelte";
  import CategoryStatsTable from "$lib/components/stats/CategoryStatsTable.svelte";
  import configState from "$lib/state/config.svelte";
  import { untrack } from "svelte";

  let viewMode = $state<"overview" | "challenges" | "categories">("categories");
  let selectedDivision = $state<number>(1);

  let apiDivisions = $state(wrapLoadable(api.GET("/divisions")));
  let apiChallenges = $state(wrapLoadable(api.GET("/challenges")));
  let apiChallengeStats = $state(
    wrapLoadable(
      api.GET("/stats/challenges", {
        params: { query: { division_id: untrack(() => selectedDivision) } },
      }),
    ),
  );
  let apiUserStats = $state(wrapLoadable(api.GET("/stats/users")));

  const divisions = $derived(apiDivisions.r?.data?.data || []);
  const challenges = $derived(apiChallenges.r?.data?.data.challenges || []);

  const challengeMap = $derived.by(() => {
    const map = new Map();
    challenges.forEach((challenge) => {
      map.set(challenge.id, challenge);
    });
    return map;
  });

  const challengeStats = $derived(
    apiChallengeStats.r?.data?.data?.entries || [],
  );
  const userStats = $derived(
    apiUserStats.r?.data?.data || { user_count: 0, team_count: 0 },
  );

  function refreshData() {
    apiUserStats = wrapLoadable(api.GET("/stats/users"));
    apiChallengeStats = wrapLoadable(
      api.GET("/stats/challenges", {
        params: { query: { division_id: untrack(() => selectedDivision) } },
      }),
    );
  }

  const loading = $derived(
    apiChallengeStats.loading || apiDivisions.loading || apiChallenges.loading,
  );
</script>

<div class="container mx-auto p-6">
  <div
    class="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6"
  >
    <div>
      <h1 class="text-4xl font-bold">
        {configState.siteConfig?.name || "Dashboard"}
      </h1>
    </div>

    <div class="flex flex-col sm:flex-row gap-4 mt-4 lg:mt-0">
      {#if divisions.length > 1}
        <div class="form-control">
          <label class="label" for="division-select">
            <span class="label-text font-medium">Division</span>
          </label>
          <select
            id="division-select"
            class="select select-bordered select-sm bg-base-100 pop hover:pop w-full sm:w-auto"
            style="line-height: 100%;"
            bind:value={selectedDivision}
            onchange={refreshData}
          >
            {#each divisions as division}
              <option value={division.id}>{division.name}</option>
            {/each}
          </select>
        </div>
      {/if}

      <div class="form-control">
        <div class="join" id="view-mode">
          <button
            class="btn join-item btn-sm {viewMode === 'overview'
              ? 'btn-primary'
              : 'bg-base-100'} pop hover:pop"
            onclick={() => (viewMode = "overview")}
          >
            <Icon icon="material-symbols:analytics" class="text-sm" />
            Overview
          </button>
          <button
            class="btn join-item btn-sm {viewMode === 'challenges'
              ? 'btn-primary'
              : 'bg-base-100'} pop hover:pop"
            onclick={() => (viewMode = "challenges")}
          >
            <Icon icon="material-symbols:quiz" class="text-sm" />
            Challenges
          </button>

          <button
            class="btn join-item btn-sm {viewMode === 'categories'
              ? 'btn-primary'
              : 'bg-base-100'} pop hover:pop"
            onclick={() => (viewMode = "categories")}
          >
            <Icon icon="material-symbols:category" class="text-sm" />
            Categories
          </button>
        </div>
      </div>
      <button
        class="btn bg-base-100 join-item btn-sm pop hover:pop"
        onclick={refreshData}
      >
        <Icon icon="material-symbols:refresh" class="text-sm" />
        Refresh
      </button>
    </div>
  </div>

  {#if apiChallengeStats.error || apiDivisions.error || apiChallenges.error}
    <div class="alert alert-error mb-6">
      <Icon icon="material-symbols:error" />
      <span>Failed to load dashboard. Please try refreshing the page.</span>
    </div>
  {/if}

  <div class="space-y-6">
    {#if viewMode === "overview"}
      <StatsOverview
        {challengeStats}
        {userStats}
        {loading}
        title="Challenge Statistics Overview"
      />
    {:else if viewMode === "challenges"}
      <ChallengeStatsTable
        {challengeStats}
        {userStats}
        {challengeMap}
        {loading}
      />
    {:else if viewMode === "categories"}
      <CategoryStatsTable
        {challengeStats}
        {userStats}
        {challengeMap}
        {loading}
      />
    {/if}
  </div>
</div>
