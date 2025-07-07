<script lang="ts">
  /* eslint-disable @typescript-eslint/no-explicit-any */

  import Icon from "@iconify/svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import UserQueryService from "$lib/state/user_query.svelte";
  import TeamQueryService from "$lib/state/team_query.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import SubmissionsTable from "$lib/components/SubmissionsTable.svelte";

  let currentPage = $state(0);
  let statusFilter = $state<string[]>([]);
  let hiddenFilter = $state<boolean | undefined>(undefined);
  let userIdFilter = $state("");
  let teamIdFilter = $state("");
  let challengeIdFilter = $state("");
  let dataFilter = $state("");
  const pageSize = 50;

  const submissions = $derived.by(() => {
    const filters: any = {
      page_size: pageSize,
      page: currentPage + 1,
    };

    if (statusFilter.length > 0) {
      filters.status = statusFilter;
    }

    if (hiddenFilter !== undefined) {
      filters.hidden = hiddenFilter;
    }

    if (userIdFilter.trim()) {
      const userIds = userIdFilter
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => !isNaN(id));
      if (userIds.length > 0) {
        filters.user_id = userIds;
      }
    }

    if (teamIdFilter.trim()) {
      const teamIds = teamIdFilter
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => !isNaN(id));
      if (teamIds.length > 0) {
        filters.team_id = teamIds;
      }
    }

    if (challengeIdFilter.trim()) {
      const challengeIds = challengeIdFilter
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => !isNaN(id));
      if (challengeIds.length > 0) {
        filters.challenge_id = challengeIds;
      }
    }

    if (dataFilter.trim()) {
      filters.data = `%${dataFilter.trim()}%`;
    }

    return wrapLoadable(
      api.POST("/admin/submissions/query", {
        body: filters,
      }),
    );
  });

  const challenges = wrapLoadable(api.GET("/challenges"));

  const challengeMap = $derived.by(() => {
    if (!challenges.r?.data?.data?.challenges) return new Map();
    const map = new Map();
    challenges.r.data.data.challenges.forEach((challenge) => {
      map.set(challenge.id, challenge.title);
    });
    return map;
  });

  $effect(() => {
    if (submissions.r?.data?.data?.entries) {
      const submissionData = submissions.r.data.data.entries;
      submissionData.forEach((submission) => {
        if (submission.user_id) {
          UserQueryService.get(submission.user_id).catch(() => {});
        }
        if (submission.team_id) {
          TeamQueryService.get(submission.team_id).catch(() => {});
        }
      });
    }
  });

  function handleSearch() {
    currentPage = 0;
  }

  function getSubmissionStatusBadgeClass(status: string) {
    const statusColors = {
      correct: "badge-success",
      incorrect: "badge-error",
      queued: "badge-warning",
      invalid: "badge-neutral",
    };
    return statusColors[status as keyof typeof statusColors] || "badge-info";
  }

  function toggleStatusFilter(status: string) {
    if (statusFilter.includes(status)) {
      statusFilter = statusFilter.filter((s) => s !== status);
    } else {
      statusFilter = [...statusFilter, status];
    }
    currentPage = 0;
  }

  function clearFilters() {
    statusFilter = [];
    hiddenFilter = undefined;
    userIdFilter = "";
    teamIdFilter = "";
    challengeIdFilter = "";
    dataFilter = "";
    currentPage = 0;
  }

  async function toggleSubmissionVisibility(
    submissionId: number,
    currentlyHidden: boolean,
  ) {
    const action = currentlyHidden ? "unhide" : "hide";
    const confirmed = confirm(
      `Are you sure you want to ${action} this submission?`,
    );

    if (!confirmed) return;

    try {
      const result = await api.PUT("/admin/submissions", {
        body: {
          ids: [submissionId],
          hidden: !currentlyHidden,
        },
      });

      if (result.error) {
        alert(`Failed to ${action} submission`);
        return;
      }
    } catch (e) {
      alert(`An error occurred while trying to ${action} the submission`);
      console.error(e);
    }
  }
</script>

<div class="container mx-auto p-6">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-4xl font-bold">Submissions</h1>
  </div>

  <!-- Filters Section -->
  <div class="card bg-base-100 pop rounded-lg w-full mb-6">
    <div class="card-body">
      <h2 class="text-xl font-bold mb-4">Filters</h2>

      <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <!-- Status Filter -->
        <div class="form-control">
          <label class="label" for="status">
            <span class="label-text">Status</span>
          </label>
          <div class="flex flex-wrap gap-2">
            {#each ["correct", "incorrect", "queued", "invalid"] as status}
              <label class="cursor-pointer">
                <input
                  type="checkbox"
                  class="sr-only"
                  checked={statusFilter.includes(status)}
                  onchange={() => toggleStatusFilter(status)}
                />
                <div
                  class={`btn btn-sm ${statusFilter.includes(status) ? getSubmissionStatusBadgeClass(status) : "btn-outline"} pop hover:pop`}
                >
                  {#if statusFilter.includes(status)}
                    <Icon icon="material-symbols:check" class="text-sm" />
                  {/if}
                  {status}
                </div>
              </label>
            {/each}
          </div>
        </div>

        <!-- Hidden Filter -->
        <div class="form-control">
          <label class="label" for="visibility">
            <span class="label-text">Visibility</span>
          </label>
          <select
            bind:value={hiddenFilter}
            class="select select-bordered"
            onchange={() => (currentPage = 0)}
          >
            <option value={undefined}>All submissions</option>
            <option value={false}>Visible only</option>
            <option value={true}>Hidden only</option>
          </select>
        </div>

        <!-- User ID Filter -->
        <div class="form-control">
          <label class="label" for="user-id">
            <span class="label-text">User IDs (comma-separated)</span>
          </label>
          <input
            type="text"
            placeholder="e.g., 1,2,3"
            class="input input-bordered"
            bind:value={userIdFilter}
            onkeydown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>

        <!-- Team ID Filter -->
        <div class="form-control">
          <label class="label" for="team-id">
            <span class="label-text">Team IDs (comma-separated)</span>
          </label>
          <input
            type="text"
            placeholder="e.g., 1,2,3"
            class="input input-bordered"
            bind:value={teamIdFilter}
            onkeydown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>

        <!-- Challenge ID Filter -->
        <div class="form-control">
          <label class="label" for="challenge-id">
            <span class="label-text">Challenge IDs (comma-separated)</span>
          </label>
          <input
            type="text"
            placeholder="e.g., 1,2,3"
            class="input input-bordered"
            bind:value={challengeIdFilter}
            onkeydown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>

        <!-- Data Filter -->
        <div class="form-control">
          <label class="label" for="data">
            <span class="label-text">Data contains</span>
          </label>
          <input
            type="text"
            placeholder="Search in submission data..."
            class="input input-bordered"
            bind:value={dataFilter}
            onkeydown={(e) => e.key === "Enter" && handleSearch()}
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

  {#if submissions.loading}
    <div class="flex justify-center items-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if submissions.error}
    <div class="alert alert-error">
      <Icon icon="material-symbols:error" />
      <span>Failed to load submissions</span>
    </div>
  {:else if submissions.r?.data?.data}
    {@const data = submissions.r.data.data}

    <!-- Submissions Table -->
    <SubmissionsTable
      submissions={data.entries}
      {challengeMap}
      showUser={true}
      showTeam={true}
      showActions={true}
      variant="full"
      onVisibilityToggle={toggleSubmissionVisibility}
    />

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
