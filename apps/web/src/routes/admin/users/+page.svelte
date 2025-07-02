<script lang="ts">
  import Icon from "@iconify/svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import TeamQueryService from "$lib/state/team_query.svelte";
  import Pagination from "$lib/components/Pagination.svelte";

  let searchQuery = $state("");
  let currentPage = $state(0);
  let sortOrder = $state<"asc" | "desc">("asc");
  const pageSize = 50;

  const users = $derived.by(() => {
    return wrapLoadable(
      api.POST("/admin/users/query", {
        body: {
          page: currentPage + 1,
          page_size: pageSize,
          name_prefix: searchQuery || undefined,
          sort_order: sortOrder,
        },
      }),
    );
  });

  $effect(() => {
    if (users.r?.data?.data.entries) {
      const teamIds = users.r.data.data.entries
        .map((user) => user.team_id)
        .filter((id): id is number => id !== null);
      // Preload teams using TeamQueryService
      teamIds.forEach((id) => {
        TeamQueryService.get(id).catch(() => {
          // Ignore errors for preloading
        });
      });
    }
  });

  function handleSearch() {
    currentPage = 0;
  }

  function handleSort() {
    sortOrder = sortOrder === "asc" ? "desc" : "asc";
    currentPage = 0;
  }

  function formatDateTime(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  function getSortIcon() {
    return sortOrder === "asc"
      ? "material-symbols:keyboard-arrow-up"
      : "material-symbols:keyboard-arrow-down";
  }

  function getFlagBadgeClass(flag: string) {
    if (flag === "blocked") return "badge-error";
    if (flag === "hidden") return "badge-neutral";
    return "badge-warning";
  }

  function getRoleBadgeClass(role: string) {
    const roleColors = {
      admin: "badge-primary",
      moderator: "badge-warning",
      judge: "badge-success",
    };
    return roleColors[role as keyof typeof roleColors] || "badge-info";
  }
</script>

<div class="container mx-auto p-6">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-4xl font-bold">Users</h1>
  </div>

  <!-- Search Bar -->
  <div class="mb-6">
    <div class="flex gap-2">
      <input
        type="text"
        placeholder="Search users by name..."
        class="input input-bordered flex-1"
        bind:value={searchQuery}
        onkeydown={(e) => e.key === "Enter" && handleSearch()}
      />
      <button class="btn btn-primary pop" onclick={handleSearch}>
        <Icon icon="material-symbols:search" class="text-xl" />
        Search
      </button>
    </div>
  </div>

  {#if users.loading}
    <div class="flex justify-center items-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if users.error}
    <div class="alert alert-error">
      <Icon icon="material-symbols:error" />
      <span>Failed to load users</span>
    </div>
  {:else if users.r?.data}
    {@const data = users.r.data.data}

    <!-- Users Table -->
    <div class="overflow-x-auto pop rounded-lg">
      <table
        class="table table-sm table-fixed bg-base-100 w-full"
        aria-label="Users list"
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
              class="w-48 border-r-2 border-base-400 font-semibold"
            >
              Team
            </th>
            <th
              scope="col"
              class="w-32 border-r-2 border-base-400 text-center font-semibold"
            >
              Flags
            </th>
            <th
              scope="col"
              class="w-32 border-r-2 border-base-400 text-center font-semibold"
            >
              Roles
            </th>
            <th scope="col" class="w-48 text-center font-semibold">
              <button
                class="flex items-center gap-1 hover:text-primary transition-colors mx-auto"
                onclick={handleSort}
              >
                Created
                <Icon icon={getSortIcon()} class="text-sm" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {#each data.entries as user}
            <tr
              class="border border-r border-base-300 hover:bg-base-50 transition-colors"
            >
                <td
                 class="border-r border-base-400 text-center font-mono text-sm"
               >
                 {user.id}
               </td>               <td class="border-r border-base-400 font-semibold">
                 <a href="/admin/user/{user.id}" class="link link-primary hover:link-hover">
                   {user.name}
                 </a>
               </td>              <td class="border-r border-base-400">
                {#if user.team_id}
                  {#await TeamQueryService.get(user.team_id)}
                    <span class="text-base-content/60">(Team {user.team_id})</span
                    >
                  {:then team}
                    <span class="text-sm"
                      >{team?.name || `(Team ${user.team_id})`}</span
                    >
                  {:catch}
                    <span class="text-base-content/60">(Team {user.team_id})</span
                    >
                  {/await}
                {:else}
                  <span class="text-base-content/60">No team</span>
                {/if}
              </td>
              <td class="border-r border-base-400 text-center">
                {#if user.flags && user.flags.length > 0}
                  <div class="flex gap-1 flex-wrap justify-center">
                    {#each user.flags as flag}
                      <span class="badge {getFlagBadgeClass(flag)} badge-sm pop"
                        >{flag}</span
                      >
                    {/each}
                  </div>
                {:else}
                  <span class="text-base-content/60">None</span>
                {/if}
              </td>
              <td class="border-r border-base-400 text-center">
                {#if user.roles && user.roles.length > 0}
                  <div class="flex gap-1 flex-wrap justify-center">
                    {#each user.roles as role}
                      <span class="badge {getRoleBadgeClass(role)} badge-sm pop"
                        >{role}</span
                      >
                    {/each}
                  </div>
                {:else}
                  <span class="text-base-content/60">None</span>
                {/if}
              </td>
              <td class="text-center text-sm text-base-content/70 font-mono">
                {formatDateTime(user.created_at)}
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
