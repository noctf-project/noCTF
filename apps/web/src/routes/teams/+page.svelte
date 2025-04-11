<script lang="ts">
  import Icon from "@iconify/svelte";
  import TeamService from "$lib/state/team.svelte";
  import type { Team } from "$lib/state/team.svelte";
  import { onMount } from "svelte";
  import { toasts } from "$lib/stores/toast";
  import { countryCodeToFlag } from "$lib/utils/country_flags";
  import Pagination from "$lib/components/Pagination.svelte";

  const TEAMS_PER_PAGE = 60;

  let currentPage = $state(0);
  let searchQuery = $state("");
  let isLoading = $state(true);
  let allTeams: Team[] = $state([]);

  const filteredTeams = $derived(
    searchQuery
      ? allTeams.filter((team) =>
          team.name.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : allTeams,
  );

  const paginatedTeams = $derived(
    filteredTeams.slice(
      currentPage * TEAMS_PER_PAGE,
      (currentPage + 1) * TEAMS_PER_PAGE,
    ),
  );

  $effect(() => {
    if (searchQuery) {
      currentPage = 0;
    }
  });

  onMount(async () => {
    try {
      const teams = await TeamService.getAllTeams();
      allTeams = teams;
    } catch (error) {
      console.error("Failed to load teams:", error);
      toasts.error("Failed to load teams. Please try again later.");
    } finally {
      isLoading = false;
    }
  });
</script>

<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
  <h1 class="text-4xl font-bold">Teams</h1>

  <div class="flex flex-row md:flex-row justify-between items-end mb-8 gap-6">
    <div class="text-lg">
      <span class="font-semibold text-primary">{allTeams.length}</span> teams registered
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
          onclick={() => (searchQuery = "")}
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
  {:else if filteredTeams.length === 0}
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
          onclick={() => (searchQuery = "")}
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
      {#each paginatedTeams as team (`team-${team.id}`)}
        <a
          href="/team/{team.id}"
          class="group relative bg-base-100 overflow-hidden rounded-xl border border-base-300 p-5 flex flex-col
                 hover:border-primary hover:shadow-md transition-all duration-200 pop hover:pop"
        >
          <div class="flex items-center justify-between mb-3">
            <h2
              class="text-xl font-bold text-primary group-hover:underline decoration-2 underline-offset-2"
            >
              {team.name}
            </h2>
            <div class="flex-shrink-0 opacity-80" title="Country">
              {countryCodeToFlag("au")}
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
                >{team.num_members} member{team.num_members === 1
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
      totalItems={filteredTeams.length}
      itemsPerPage={TEAMS_PER_PAGE}
      onChange={(page) => (currentPage = page)}
      className="mt-10"
    />
  {/if}
</div>
