<script lang="ts">
  /* eslint-disable @typescript-eslint/no-explicit-any */

  import Icon from "@iconify/svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import UserQueryService from "$lib/state/user_query.svelte";
  import TeamQueryService from "$lib/state/team_query.svelte";
  import { createDebouncedFields } from "$lib/utils/debounce.svelte";
  import { fade, fly } from "svelte/transition";

  const FILTER_DEBOUNCE_MS = 300;
  const pageSize = 50;

  let currentPage = $state(0);

  let showDataModal = $state(false);
  let modalData = $state("");

  const filters = createDebouncedFields(
    {
      actorFilter: "",
      operationFilter: "",
      entitiesFilter: "",
      startDateFilter: "",
      endDateFilter: "",
    },
    FILTER_DEBOUNCE_MS,
    () => {
      currentPage = 0;
    },
  );

  const auditLogs = $derived.by(() => {
    const queryFilters: any = {
      page_size: pageSize,
      page: currentPage + 1,
    };

    if (filters.debouncedValues.actorFilter.trim()) {
      const actors = filters.debouncedValues.actorFilter
        .split(",")
        .map((actor) => actor.trim())
        .filter((actor) => actor.length > 0);
      if (actors.length > 0) {
        queryFilters.actor = actors;
      }
    }

    if (filters.debouncedValues.operationFilter.trim()) {
      const operations = filters.debouncedValues.operationFilter
        .split(",")
        .map((op) => `%${op.trim()}%`)
        .filter((op) => op.length > 0);
      if (operations.length > 0) {
        queryFilters.operation = operations;
      }
    }

    if (filters.debouncedValues.entitiesFilter.trim()) {
      const entities = filters.debouncedValues.entitiesFilter
        .split(",")
        .map((entity) => entity.trim())
        .filter((entity) => entity.length > 0);
      if (entities.length > 0) {
        queryFilters.entities = entities;
      }
    }

    if (
      filters.debouncedValues.startDateFilter ||
      filters.debouncedValues.endDateFilter
    ) {
      queryFilters.created_at = [
        filters.debouncedValues.startDateFilter
          ? new Date(filters.debouncedValues.startDateFilter)
          : null,
        filters.debouncedValues.endDateFilter
          ? new Date(filters.debouncedValues.endDateFilter)
          : null,
      ];
    }

    return wrapLoadable(
      api.POST("/admin/audit_log/query", {
        body: queryFilters,
      }),
    );
  });

  function handleSearch() {
    filters.forceUpdate();
    currentPage = 0;
  }

  function clearFilters() {
    filters.reset();
    currentPage = 0;
  }

  function formatDateTime(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  function formatActor(actor: string) {
    const parts = actor.split(":");
    if (parts.length === 2) {
      const [type, id] = parts;
      return { type: type || "unknown", id };
    }
    return { type: actor || "unknown", id: null };
  }

  function formatEntity(entity: string) {
    const parts = entity.split(":");
    if (parts.length === 2) {
      const [type, id] = parts;
      return { type: type || "unknown", id };
    }
    return { type: entity || "unknown", id: null };
  }

  function getActorBadgeClass(actorType: string) {
    const typeColors = {
      user: "badge-primary",
      admin: "badge-error",
      system: "badge-neutral",
      api: "badge-info",
    };
    return (
      typeColors[actorType.toLowerCase() as keyof typeof typeColors] ||
      "badge-ghost"
    );
  }

  function getEntityBadgeClass(entityType: string) {
    const typeColors = {
      user: "badge-primary",
      team: "badge-secondary",
      challenge: "badge-accent",
      submission: "badge-info",
      division: "badge-warning",
      policy: "badge-neutral",
      team_tag: "badge-ghost",
    };
    return (
      typeColors[entityType.toLowerCase() as keyof typeof typeColors] ||
      "badge-ghost"
    );
  }

  function openDataModal(data: string) {
    modalData = data;
    showDataModal = true;
  }

  function closeDataModal() {
    showDataModal = false;
    modalData = "";
  }

  function outsideClickHandler(node: Node) {
    const handleClick = (event: Event) => {
      if (
        node &&
        !node.contains(event.target as Node) &&
        !event.defaultPrevented
      ) {
        closeDataModal();
        document.removeEventListener("click", handleClick, true);
      }
    };
    document.addEventListener("click", handleClick, true);
    return {
      destroy() {
        document.removeEventListener("click", handleClick, true);
      },
    };
  }

  function getOperationBadgeClass(operation: string) {
    if (operation.includes("create") || operation.includes("add")) {
      return "badge-success";
    }
    if (operation.includes("delete") || operation.includes("remove")) {
      return "badge-error";
    }
    if (
      operation.includes("update") ||
      operation.includes("edit") ||
      operation.includes("modify") ||
      operation.includes("assign")
    ) {
      return "badge-warning";
    }
    return "badge-info";
  }
</script>

<div class="container mx-auto p-6">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-4xl font-bold">Audit Logs</h1>
  </div>

  <!-- Filters Section -->
  <div class="card bg-base-100 pop rounded-lg w-full mb-6">
    <div class="card-body">
      <h2 class="text-xl font-bold mb-4">Filters</h2>

      <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <!-- Actor Filter -->
        <div class="form-control">
          <label class="label" for="actor">
            <span class="label-text">Actors (comma-separated)</span>
          </label>
          <input
            type="text"
            placeholder="e.g., user:123, system, admin:456"
            class="input input-bordered"
            bind:value={filters.values.actorFilter}
            onkeydown={(e) => e.key === "Enter" && handleSearch()}
          />
          <div class="label">
            <span class="label-text-alt">Format: type:id or just type</span>
          </div>
        </div>

        <!-- Operation Filter -->
        <div class="form-control">
          <label class="label" for="operation">
            <span class="label-text">Operations (comma-separated)</span>
          </label>
          <input
            type="text"
            placeholder="e.g., user.create, team.update"
            class="input input-bordered"
            bind:value={filters.values.operationFilter}
            onkeydown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>

        <!-- Entities Filter -->
        <div class="form-control">
          <label class="label" for="entities">
            <span class="label-text">Entities (comma-separated)</span>
          </label>
          <input
            type="text"
            placeholder="e.g., user:123, team:456"
            class="input input-bordered"
            bind:value={filters.values.entitiesFilter}
            onkeydown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>

        <!-- Start Date Filter -->
        <div class="form-control">
          <label class="label" for="start-date">
            <span class="label-text">Start Date</span>
          </label>
          <input
            type="datetime-local"
            class="input input-bordered"
            bind:value={filters.values.startDateFilter}
          />
        </div>

        <!-- End Date Filter -->
        <div class="form-control">
          <label class="label" for="end-date">
            <span class="label-text">End Date</span>
          </label>
          <input
            type="datetime-local"
            class="input input-bordered"
            bind:value={filters.values.endDateFilter}
          />
        </div>
      </div>

      <div class="flex gap-2 mt-4">
        <button class="btn btn-primary pop hover:pop" onclick={handleSearch}>
          <Icon icon="material-symbols:search" class="text-xl" />
          Apply Filters
        </button>
        <button class="btn btn-ghost pop hover:pop" onclick={clearFilters}>
          <Icon icon="material-symbols:clear" class="text-xl" />
          Clear All
        </button>
      </div>
    </div>
  </div>

  {#if auditLogs.loading}
    <div class="flex justify-center items-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if auditLogs.error}
    <div class="alert alert-error">
      <Icon icon="material-symbols:error" />
      <span>Failed to load audit logs</span>
    </div>
  {:else if auditLogs.r?.data?.data}
    {@const data = auditLogs.r.data.data}

    <!-- Audit Logs Table -->
    <div class="overflow-x-auto pop rounded-lg">
      <table
        class="table table-sm table-fixed bg-base-100 w-full"
        aria-label="Audit logs list"
      >
        <thead>
          <tr class="bg-base-300 border-b-2 border-base-400">
            <th
              scope="col"
              class="w-32 border-r-2 border-base-400 text-center font-semibold"
            >
              Timestamp
            </th>
            <th
              scope="col"
              class="w-32 border-r-2 border-base-400 font-semibold"
            >
              Actor
            </th>
            <th
              scope="col"
              class="w-40 border-r-2 border-base-400 font-semibold"
            >
              Operation
            </th>
            <th
              scope="col"
              class="w-56 border-r-2 border-base-400 font-semibold"
            >
              Entities
            </th>
            <th scope="col" class="font-semibold"> Data </th>
          </tr>
        </thead>
        <tbody>
          {#each data.entries as entry}
            {@const actorInfo = formatActor(entry.actor)}
            <tr
              class="border border-r border-base-300 hover:bg-base-50 transition-colors"
            >
              <td
                class="border-r border-base-400 text-center text-sm text-base-content/70 font-mono"
              >
                {formatDateTime(entry.created_at)}
              </td>
              <td class="border-r border-base-400">
                <div class="flex flex-col gap-1">
                  {#if actorInfo.type === "user" && actorInfo.id}
                    {#await UserQueryService.get(Number(actorInfo.id))}
                      <span
                        class="badge {getActorBadgeClass(
                          actorInfo.type,
                        )} pop badge-sm"
                      >
                        User {actorInfo.id}
                      </span>
                    {:then user}
                      <a
                        href="/admin/user/{actorInfo.id}"
                        class="badge {getActorBadgeClass(
                          actorInfo.type,
                        )} pop badge-sm hover:badge-primary-focus transition-colors"
                      >
                        {user?.name || `User ${actorInfo.id}`}
                      </a>
                    {:catch}
                      <span
                        class="badge {getActorBadgeClass(
                          actorInfo.type,
                        )} pop badge-sm"
                      >
                        User {actorInfo.id}
                      </span>
                    {/await}
                  {:else}
                    <span
                      class="badge {getActorBadgeClass(
                        actorInfo.type,
                      )} pop badge-sm"
                    >
                      {actorInfo.type}
                    </span>
                  {/if}
                  {#if actorInfo.id}
                    <span class="text-xs text-base-content/60 font-mono">
                      ID: {actorInfo.id}
                    </span>
                  {/if}
                </div>
              </td>
              <td class="border-r border-base-400">
                <span
                  class="badge {getOperationBadgeClass(
                    entry.operation,
                  )} pop badge-sm"
                >
                  {entry.operation}
                </span>
              </td>
              <td class="border-r border-base-400">
                {#if entry.entities.length > 0}
                  <div class="flex flex-wrap gap-1">
                    {#each entry.entities as entity}
                      {@const entityInfo = formatEntity(entity)}
                      {#if entityInfo.type === "user" && entityInfo.id}
                        {#await UserQueryService.get(Number(entityInfo.id))}
                          <span
                            class="badge {getEntityBadgeClass(
                              entityInfo.type,
                            )} pop badge-sm font-mono"
                          >
                            User {entityInfo.id}
                          </span>
                        {:then user}
                          <a
                            href="/admin/user/{entityInfo.id}"
                            class="badge {getEntityBadgeClass(
                              entityInfo.type,
                            )} pop badge-sm hover:badge-primary-focus transition-colors"
                          >
                            {user?.name || `User ${entityInfo.id}`}
                          </a>
                        {:catch}
                          <span
                            class="badge {getEntityBadgeClass(
                              entityInfo.type,
                            )} pop badge-sm font-mono"
                          >
                            User {entityInfo.id}
                          </span>
                        {/await}
                      {:else if entityInfo.type === "team" && entityInfo.id}
                        {#await TeamQueryService.get(Number(entityInfo.id))}
                          <span
                            class="badge {getEntityBadgeClass(
                              entityInfo.type,
                            )} pop badge-sm font-mono"
                          >
                            Team {entityInfo.id}
                          </span>
                        {:then team}
                          <a
                            href="/admin/team/{entityInfo.id}"
                            class="badge {getEntityBadgeClass(
                              entityInfo.type,
                            )} pop badge-sm hover:badge-secondary-focus transition-colors"
                          >
                            {team?.name || `Team ${entityInfo.id}`}
                          </a>
                        {:catch}
                          <span
                            class="badge {getEntityBadgeClass(
                              entityInfo.type,
                            )} pop badge-sm font-mono"
                          >
                            Team {entityInfo.id}
                          </span>
                        {/await}
                      {:else}
                        <span
                          class="badge {getEntityBadgeClass(
                            entityInfo.type,
                          )} pop badge-sm font-mono"
                        >
                          {entity}
                        </span>
                      {/if}
                    {/each}
                  </div>
                {:else}
                  <span class="text-base-content/60 italic text-sm">None</span>
                {/if}
              </td>
              <td>
                {#if entry.data}
                  <button
                    class="truncate font-mono text-sm w-full text-left hover:bg-base-200 p-1 rounded transition-colors cursor-pointer"
                    title="Click to view full data"
                    onclick={() => openDataModal(entry.data || "")}
                  >
                    {entry.data}
                  </button>
                {:else}
                  <span class="text-base-content/60 italic text-sm"
                    >No data</span
                  >
                {/if}
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

<!-- Data Modal -->
{#if showDataModal}
  <div
    in:fade={{ duration: 100 }}
    out:fade={{ duration: 100 }}
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 pop"
  >
    <div
      class="bg-base-100 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col"
      in:fly={{ y: 25, duration: 150, delay: 100 }}
      out:fade={{ duration: 100 }}
      use:outsideClickHandler
    >
      <div
        class="flex justify-between items-center p-6 border-b border-base-300"
      >
        <h3 class="text-xl font-bold">Audit Log Data</h3>
        <button
          class="btn btn-ghost btn-sm"
          onclick={closeDataModal}
          aria-label="Close modal"
        >
          <Icon icon="material-symbols:close" class="text-xl" />
        </button>
      </div>
      <div class="p-6 overflow-auto flex-1">
        <pre
          class="bg-base-200 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap break-words">{modalData}</pre>
      </div>
      <div class="flex justify-end gap-2 p-6 border-t border-base-300">
        <button class="btn bg-base-200 pop hover:pop" onclick={closeDataModal}>
          Close
        </button>
        <button
          class="btn btn-primary pop hover:pop"
          onclick={() => navigator.clipboard.writeText(modalData)}
        >
          <Icon icon="material-symbols:content-copy" class="text-lg" />
          Copy to Clipboard
        </button>
      </div>
    </div>
  </div>
{/if}
