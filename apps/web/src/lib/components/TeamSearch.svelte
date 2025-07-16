<script lang="ts">
  import Icon from "@iconify/svelte";
  import api from "$lib/api/index.svelte";
  import { createDebouncedState } from "$lib/utils/debounce.svelte";

  type AdminTeam = {
    id: number;
    name: string;
    bio: string;
    created_at: string;
    country?: string | null;
    division_id?: number;
  };

  interface Props {
    onTeamSelect: (team: AdminTeam) => void;
    placeholder?: string;
    showBio?: boolean;
    showCreatedAt?: boolean;
    buttonText?: string;
    excludedTeamIds?: number[];
  }

  let {
    onTeamSelect,
    placeholder = "Enter team name to search...",
    showBio = false,
    showCreatedAt = false,
    buttonText = "Select Team",
    excludedTeamIds = [],
  }: Props = $props();

  const teamSearchQuery = createDebouncedState("", 300);
  let teamSearchResults = $state<AdminTeam[]>([]);
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
      const { data, error } = await api.POST("/admin/teams/query", {
        body: {
          page: 1,
          page_size: 20,
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

  function handleTeamSelect(team: AdminTeam) {
    onTeamSelect(team);
    teamSearchQuery.value = "";
    teamSearchResults = [];
  }

  function formatDateTime(dateString: string) {
    return new Date(dateString).toLocaleString();
  }
</script>

<div class="card bg-base-100 pop rounded-lg w-full">
  <div class="card-body">
    <div class="space-y-4">
      <!-- Search Input -->
      <div class="form-control w-full">
        <label for="team-search" class="label">
          <span class="label-text">Search for teams by name</span>
        </label>
        <input
          id="team-search"
          type="text"
          bind:value={teamSearchQuery.value}
          class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
          {placeholder}
        />
      </div>

      <!-- Search Results -->
      {#if teamSearchLoading}
        <div class="flex justify-center items-center py-4">
          <span class="loading loading-spinner loading-md"></span>
          <span class="ml-2">Searching teams...</span>
        </div>
      {:else if teamSearchError}
        <div class="alert alert-error pop">
          <Icon icon="material-symbols:error" />
          <span>{teamSearchError}</span>
        </div>
      {:else if teamSearchQuery.debouncedValue && teamSearchResults.length === 0}
        <div class="text-center py-4 text-base-content/70">
          <p>
            No teams found matching "{teamSearchQuery.debouncedValue}"
          </p>
        </div>
      {:else if teamSearchResults.length > 0}
        <div class="space-y-2">
          <h3 class="font-semibold">Search Results:</h3>
          <div
            class="pop border border-base-500 bg-base-100 rounded-lg overflow-x-auto max-h-64 overflow-y-auto"
          >
            <table class="w-full border-collapse">
              <thead>
                <tr>
                  <th
                    class="border-y border-base-300 bg-base-200 py-2 px-3 text-left font-bold sticky top-0"
                    >Team</th
                  >
                  <th
                    class="border-y border-base-300 bg-base-200 py-2 px-3 text-left font-bold sticky top-0"
                    >ID</th
                  >
                  {#if showCreatedAt}
                    <th
                      class="border-y border-base-300 bg-base-200 py-2 px-3 text-left font-bold sticky top-0"
                      >Created</th
                    >
                  {/if}
                  <th
                    class="border-y border-base-300 bg-base-200 py-2 px-3 text-right font-bold sticky top-0"
                    >Action</th
                  >
                </tr>
              </thead>
              <tbody>
                {#each teamSearchResults as team}
                  {@const isAlreadySelected = excludedTeamIds.includes(team.id)}
                  <tr
                    class="bg-base-100 hover:bg-base-300/30"
                    class:opacity-50={isAlreadySelected}
                  >
                    <td class="border-y border-base-300 py-2 px-3">
                      <div class="flex flex-col">
                        <span class="font-medium">{team.name}</span>
                        {#if showBio && team.bio}
                          <span class="text-sm text-base-content/60"
                            >{team.bio}</span
                          >
                        {/if}
                        {#if isAlreadySelected}
                          <span class="text-xs text-success font-medium"
                            >Already selected</span
                          >
                        {/if}
                      </div>
                    </td>
                    <td class="border-y border-base-300 py-2 px-3">
                      <span class="font-mono text-sm">{team.id}</span>
                    </td>
                    {#if showCreatedAt}
                      <td class="border-y border-base-300 py-2 px-3">
                        <span class="text-sm text-base-content/70 font-mono">
                          {formatDateTime(team.created_at)}
                        </span>
                      </td>
                    {/if}
                    <td class="border-y border-base-300 py-2 px-3 text-right">
                      {#if isAlreadySelected}
                        <button class="btn btn-success btn-sm" disabled>
                          <Icon icon="material-symbols:check" class="text-sm" />
                          Selected
                        </button>
                      {:else}
                        <button
                          class="btn btn-primary btn-sm pop hover:pop"
                          onclick={() => handleTeamSelect(team)}
                        >
                          <Icon
                            icon="material-symbols:group-add"
                            class="text-sm"
                          />
                          {buttonText}
                        </button>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
