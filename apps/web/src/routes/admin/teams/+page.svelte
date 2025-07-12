<script lang="ts">
  import Icon from "@iconify/svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import { countryCodeToFlag } from "$lib/utils/country";
  import { getFlagConfig } from "$lib/utils/team-flags";
  import { createDebouncedState } from "$lib/utils/debounce.svelte";

  let currentPage = $state(0);
  const pageSize = 50;

  const searchQuery = createDebouncedState("", 300, () => {
    currentPage = 0;
  });

  const teams = $derived.by(() => {
    return wrapLoadable(
      api.POST("/admin/teams/query", {
        body: {
          page: currentPage + 1,
          page_size: pageSize,
          name: searchQuery.debouncedValue || undefined,
        },
      }),
    );
  });

  type TeamTag = {
    id: number;
    name: string;
    is_joinable: boolean;
  };

  const apiTeamTags = wrapLoadable(api.GET("/team_tags"));
  const teamTags: TeamTag[] = $derived(apiTeamTags.r?.data?.data?.tags || []);

  const apiDivisions = wrapLoadable(api.GET("/divisions"));
  const divisions = $derived(apiDivisions.r?.data?.data || []);

  function handleSearch() {
    searchQuery.forceUpdate();
    currentPage = 0;
  }

  function formatDateTime(dateString: string) {
    return new Date(dateString).toLocaleString();
  }
</script>

<div class="container mx-auto p-6">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-4xl font-bold">Teams</h1>
  </div>

  <!-- Search Bar -->
  <div class="mb-6">
    <div class="flex gap-2">
      <input
        type="text"
        placeholder="Search teams by name..."
        class="input input-bordered flex-1"
        bind:value={searchQuery.value}
        onkeydown={(e) => e.key === "Enter" && handleSearch()}
      />
      <button class="btn btn-primary pop" onclick={handleSearch}>
        <Icon icon="material-symbols:search" class="text-xl" />
        Search
      </button>
    </div>
  </div>

  {#if teams.loading}
    <div class="flex justify-center items-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if teams.error}
    <div class="alert alert-error">
      <Icon icon="material-symbols:error" />
      <span>Failed to load teams</span>
    </div>
  {:else if teams.r?.data}
    {@const data = teams.r.data.data}

    <!-- Teams Table -->
    <div class="overflow-x-auto pop rounded-lg">
      <table
        class="table table-sm table-fixed bg-base-100 w-full"
        aria-label="Teams list"
      >
        <thead>
          <tr class="bg-base-300 border-b-2 border-base-400">
            <th
              scope="col"
              class="w-16 border-r-2 border-base-400 text-center font-semibold"
            >
              ID
            </th>
            <th
              scope="col"
              class="w-48 border-r-2 border-base-400 font-semibold"
            >
              Name
            </th>
            <th
              scope="col"
              class="w-16 border-r-2 border-base-400 text-center font-semibold"
            >
              Division
            </th>
            <th
              scope="col"
              class="w-12 border-r-2 border-base-400 text-center font-semibold"
            >
              Members
            </th>
            <th
              scope="col"
              class="w-32 border-r-2 border-base-400 text-center font-semibold"
            >
              Tags
            </th>
            <th
              scope="col"
              class="w-32 border-r-2 border-base-400 text-center font-semibold"
            >
              Flags
            </th>
            <th scope="col" class="w-48 text-center font-semibold">
              Created
            </th>
          </tr>
        </thead>
        <tbody>
          {#each data.entries as team}
            <tr
              class="border border-r border-base-300 hover:bg-base-50 transition-colors"
            >
              <td
                class="border-r border-base-400 text-center font-mono text-sm"
              >
                {team.id}
              </td>
              <td class="border-r border-base-400 font-semibold">
                <div class="flex items-center gap-2">
                  {#if team.country}
                    <span class="text-lg" title={team.country}>
                      {countryCodeToFlag(team.country)}
                    </span>
                  {/if}
                  <a
                    href="/admin/team/{team.id}"
                    class="link link-primary hover:link-hover"
                  >
                    {team.name}
                  </a>
                </div>
              </td>
              <td class="border-r border-base-400 text-center">
                {#if team.division_id}
                  {@const division = divisions.find(
                    (d) => d.id === team.division_id,
                  )}
                  {division?.name || `Division ${team.division_id}`}
                {:else}
                  <span class="text-base-content/60">None</span>
                {/if}
              </td>
              <td class="border-r border-base-400 text-center">
                {team.members?.length || 0}
              </td>
              <td class="border-r border-base-400 text-center">
                {#if team.tag_ids && team.tag_ids.length > 0}
                  <div class="flex gap-1 flex-wrap justify-center">
                    {#each team.tag_ids as tagId}
                      {@const tag = teamTags.find((t) => t.id === tagId)}
                      <div
                        class="btn btn-xs btn-primary pop pointer-events-none"
                      >
                        {tag?.name || `Tag ${tagId}`}
                      </div>
                    {/each}
                  </div>
                {:else}
                  <span class="text-base-content/60">None</span>
                {/if}
              </td>
              <td class="border-r border-base-400 text-center">
                {#if team.flags && team.flags.length > 0}
                  <div class="flex gap-1 flex-wrap justify-center">
                    {#each team.flags as flagName}
                      {@const flagConfig = getFlagConfig(flagName)}
                      <div
                        class="btn btn-xs {flagConfig.color} text-white pop pointer-events-none"
                      >
                        <Icon icon={flagConfig.icon} class="text-xs" />
                        {flagName}
                      </div>
                    {/each}
                  </div>
                {:else}
                  <span class="text-base-content/60">None</span>
                {/if}
              </td>
              <td class="text-center text-sm text-base-content/70 font-mono">
                {formatDateTime(team.created_at)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="mt-6">
      <Pagination
        totalItems={data.total}
        itemsPerPage={pageSize}
        initialPage={currentPage}
        onChange={(page) => (currentPage = page)}
        className="mt-4"
      />
    </div>
  {/if}
</div>
