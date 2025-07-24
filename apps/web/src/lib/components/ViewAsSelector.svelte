<script lang="ts">
  import Icon from "@iconify/svelte";
  import api from "$lib/api/index.svelte";
  import { createDebouncedState } from "$lib/utils/debounce.svelte";
  import { staticHandler } from "$lib/static_export/middleware";
  import authState from "$lib/state/auth.svelte";

  type Team = {
    id: number;
    name: string;
    bio: string;
    created_at: string;
    country?: string | null;
    division_id?: number;
  };

  let isOpen = $state(false);

  const teamSearchQuery = createDebouncedState("", 300);
  let teamSearchResults = $state<Team[]>([]);
  let teamSearchLoading = $state(false);
  let teamSearchError = $state("");

  async function searchTeams() {
    if (!teamSearchQuery.debouncedValue.trim()) {
      teamSearchResults = [];
      return;
    }

    teamSearchLoading = true;
    teamSearchError = "";

    try {
      const { data, error } = await api.POST("/teams/query", {
        body: {
          page: 1,
          page_size: 10,
          name: teamSearchQuery.debouncedValue,
        },
      });

      if (error) throw new Error(error.message);
      teamSearchResults = data.data.entries;
    } catch (e) {
      teamSearchError =
        e instanceof Error ? e.message : "Failed to search teams";
      console.error(e);
      teamSearchResults = [];
    } finally {
      teamSearchLoading = false;
    }
  }

  $effect(() => {
    if (teamSearchQuery.debouncedValue) {
      searchTeams();
    } else {
      teamSearchResults = [];
    }
  });

  function handleTeamSelect(team: Team) {
    staticHandler.setViewAs(team.id);
    isOpen = false;
    teamSearchQuery.value = "";
    teamSearchResults = [];
    window.location.reload();
  }

  function handleLogout() {
    staticHandler.setViewAs(null);
    isOpen = false;
    teamSearchQuery.value = "";
    teamSearchResults = [];
    window.location.reload();
  }

  function toggleDropdown() {
    isOpen = !isOpen;
    if (!isOpen) {
      teamSearchQuery.value = "";
      teamSearchResults = [];
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleDropdown();
    }
  }
</script>

<div class="dropdown dropdown-end">
  <div
    tabindex="0"
    role="button"
    class="btn btn-primary text-primary-content px-6 sm:px-8 pop hover:pop"
    onclick={toggleDropdown}
    onkeydown={handleKeydown}
    aria-label="View as team selector"
  >
    {#if authState?.isAuthenticated}
      <div class="flex flex-row gap-2 items-center">
        <Icon icon="material-symbols:visibility" class="text-xl" />
        {authState?.user?.team_name}
      </div>
    {:else}
      <span>View as</span>
    {/if}
    <Icon icon="mdi:chevron-down" class="text-xl" />
  </div>

  {#if isOpen}
    <div
      class="dropdown-content mt-3 z-[20] p-4 pop bg-base-100 rounded-box w-80"
      tabindex="-1"
    >
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">Select Team to View As</h3>
          <button
            class="btn btn-ghost btn-sm btn-circle"
            onclick={toggleDropdown}
            aria-label="Close"
          >
            <Icon icon="material-symbols:close" />
          </button>
        </div>

        <div class="form-control w-full">
          <input
            id="view-as-search"
            type="text"
            bind:value={teamSearchQuery.value}
            class="input input-bordered input-sm w-full"
            placeholder="Search teams by name..."
          />
        </div>

        {#if teamSearchLoading}
          <div class="flex justify-center items-center py-4">
            <span class="loading loading-spinner loading-sm"></span>
            <span class="ml-2 text-sm">Searching...</span>
          </div>
        {:else if teamSearchError}
          <div class="alert alert-error">
            <Icon icon="material-symbols:error" />
            <span>{teamSearchError}</span>
          </div>
        {:else if teamSearchQuery.debouncedValue && teamSearchResults.length === 0}
          <div class="text-center py-4 text-sm text-base-content/70">
            No teams found matching "{teamSearchQuery.debouncedValue}"
          </div>
        {:else if teamSearchResults.length > 0}
          <div class="space-y-2">
            <div class="max-h-48 overflow-y-auto space-y-1">
              {#each teamSearchResults as team}
                <button
                  class="w-full text-left p-3 rounded-lg hover:bg-base-200 border border-base-300 transition-colors"
                  onclick={() => handleTeamSelect(team)}
                >
                  <div class="font-medium truncate">{team.name}</div>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        {#if authState?.isAuthenticated}
          <button
            class="w-full btn btn-outline btn-error btn-sm"
            onclick={handleLogout}
          >
            View as public
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>
