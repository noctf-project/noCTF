<script lang="ts">
  import Icon from "@iconify/svelte";
  import { onMount, untrack } from "svelte";
  import { toasts } from "$lib/stores/toast";
  import { countryCodeToFlag } from "$lib/utils/country";
  import Pagination from "$lib/components/Pagination.svelte";
  import TeamQueryService, { type Team } from "$lib/state/team_query.svelte";

  const TEAMS_PER_PAGE = 60;
  const SEARCH_DEBOUNCE_MS = 300;

  let currentPage = $state(0);
  let searchQuery = $state("");
  let previousSearchQuery = $state("");
  let debouncedSearchQuery = $state("");
  let isLoading = $state(true);
  let teams: Team[] = $state([]);
  let totalTeams = $state(0);
  let totalTeamsRegistered = $state(0);
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = $state(null);

  $effect(() => {
    if (searchQuery || searchQuery == "") {
      untrack(() => {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          if (searchQuery !== debouncedSearchQuery) {
            previousSearchQuery = debouncedSearchQuery;
            debouncedSearchQuery = searchQuery;
            if (previousSearchQuery !== searchQuery) {
              currentPage = 0;
            }
          }
          searchDebounceTimer = null;
        }, SEARCH_DEBOUNCE_MS);
      });
    }
  });

  $effect(() => {
    // re-trigger a load if the search changed or currentPage changed
    if (debouncedSearchQuery !== undefined || currentPage !== undefined) {
      loadTeams();
    }
  });

  async function loadTeams() {
    try {
      isLoading = true;

      const result = await TeamQueryService.queryTeams({
        page: currentPage + 1,
        page_size: TEAMS_PER_PAGE,
        name_prefix: debouncedSearchQuery,
      });

      teams = result.teams;
      totalTeams = result.total;

      // this should always get set on the first query when the page loads
      if (!debouncedSearchQuery) {
        totalTeamsRegistered = result.total;
      }
    } catch (error) {
      console.error("Failed to load teams:", error);
      toasts.error("Failed to load teams. Please try again later.");
    } finally {
      isLoading = false;
    }
  }

  function clearSearch() {
    searchQuery = "";
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    previousSearchQuery = debouncedSearchQuery;
    debouncedSearchQuery = "";
    if (previousSearchQuery) {
      currentPage = 0;
    }
  }

  onMount(() => {
    return () => {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    };
  });
</script>

<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
  <h1 class="text-4xl font-bold">Teams</h1>

  <div class="flex flex-row md:flex-row justify-between items-end mb-8 gap-6">
    <div class="text-lg">
      <span class="font-semibold text-primary">{totalTeamsRegistered}</span> teams
      registered
    </div>

    <div class="relative w-full md:w-96">
      <div
        class="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none"
      >
        <Icon icon="material-symbols:search" class="text-base-content/50" />
      </div>
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search teams by name..."
        class="input input-bordered w-full ps-11 bg-base-100 pop duration-200 transition-colors focus:outline-none focus:pop focus:ring-0 focus:ring-offset-0"
      />
      {#if searchQuery}
        <button
          class="absolute inset-y-0 end-0 flex items-center pe-4 hover:text-error"
          onclick={clearSearch}
        >
          <Icon icon="material-symbols:close" />
        </button>
      {/if}
    </div>
  </div>

  {#if isLoading}
    <div class="flex flex-col items-center gap-4 py-24">
      <div class="loading loading-spinner loading-lg text-primary"></div>
      <p class="text-center">Loading teams...</p>
    </div>
  {:else if teams.length === 0}
    <div
      class="border border-base-300 rounded-xl bg-base-100 flex flex-col items-center py-16 px-4 text-center"
    >
      <div
        class="w-16 h-16 mb-4 bg-base-200 rounded-full flex items-center justify-center"
      >
        <Icon icon="material-symbols:search-off" class="text-4xl opacity-70" />
      </div>
      <h3 class="text-xl font-bold mb-1">No teams match your search</h3>
      <p class="text-base-content/70 mb-6 max-w-md">
        Try adjusting your search terms or check for typos
      </p>
      {#if searchQuery}
        <button
          class="btn btn-outline gap-2 pop hover:pop"
          onclick={clearSearch}
        >
          <Icon icon="material-symbols:refresh" />
          Clear search
        </button>
      {/if}
    </div>
  {:else}
    <div
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    >
      {#each teams as team (`team-${team.id}`)}
        <a
          href="/teams/{team.id}"
          class="group relative bg-base-100 overflow-hidden rounded-xl border border-base-300 p-5 flex flex-col
                 hover:border-primary hover:shadow-md transition-all duration-200 pop hover:pop"
        >
          <div class="flex items-center justify-between mb-3">
            <h2
              class="text-xl font-bold text-primary group-hover:underline decoration-2 underline-offset-2 truncate"
              title={team.name}
            >
              {team.name}
            </h2>
            <div class="flex-shrink-0 opacity-80" title="Country">
              {countryCodeToFlag(team.country || "un")}
            </div>
          </div>

          <p class="text-sm text-base-content/70 mb-4 line-clamp-1 h-5">
            {team.bio}
          </p>
          <div
            class="mt-auto pt-3 border-t border-base-200 flex justify-between items-center"
          >
            <div class="flex items-center gap-1.5">
              <Icon
                icon="material-symbols:group"
                class="text-lg text-base-content/70"
              />
              <span class="text-sm font-medium"
                >{team.members.length} member{team.members.length === 1
                  ? ""
                  : "s"}</span
              >
            </div>
            <Icon
              icon="material-symbols:arrow-forward"
              class="text-base-content/50 group-hover:text-primary transition-colors"
            />
          </div>
        </a>
      {/each}
    </div>

    <Pagination
      totalItems={totalTeams}
      itemsPerPage={TEAMS_PER_PAGE}
      initialPage={currentPage}
      onChange={(page) => (currentPage = page)}
      className="mt-10"
    />
  {/if}
</div>
