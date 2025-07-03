<script lang="ts">
  import { page } from "$app/state";
  import Icon from "@iconify/svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import TeamQueryService from "$lib/state/team_query.svelte";
  import SubmissionsTable from "$lib/components/SubmissionsTable.svelte";

  const userId = Number(page.params.id);

  const user = wrapLoadable(
    api.POST("/admin/users/query", {
      body: { ids: [userId] },
    }),
  );

  const submissions = wrapLoadable(
    api.POST("/admin/submissions/query", {
      body: {
        user_id: [userId],
        offset: 0,
      },
    }),
  );

  const challenges = wrapLoadable(api.GET("/challenges"));

  // Create a lookup map for challenge names
  const challengeMap = $derived.by(() => {
    if (!challenges.r?.data?.data?.challenges) return new Map();
    const map = new Map();
    challenges.r.data.data.challenges.forEach((challenge) => {
      map.set(challenge.id, challenge.title);
    });
    return map;
  });

  let editMode = $state(false);
  let loading = $state(false);
  let error = $state("");
  let success = $state("");

  let editForm = $state({
    name: "",
    bio: "",
    flags: [] as string[],
    roles: [] as string[],
  });

  let newFlag = $state("");
  let newRole = $state("");

  $effect(() => {
    if (user.r?.data?.data.entries?.[0]) {
      const userData = user.r.data.data.entries[0];
      editForm = {
        name: userData.name,
        bio: userData.bio,
        flags: [...userData.flags],
        roles: [...userData.roles],
      };
    }
  });

  async function saveUser() {
    loading = true;
    error = "";
    success = "";

    try {
      const result = await api.PUT("/users/{id}", {
        params: { path: { id: userId } },
        body: {
          name: editForm.name,
          bio: editForm.bio,
        },
      });

      if (result.error) {
        error = "Failed to update user";
        return;
      }

      success = "User updated successfully!";
      editMode = false;

      // Refresh user data
      const refreshedData = await api.POST("/admin/users/query", {
        body: { ids: [userId] },
      });
      user.r = refreshedData;
    } catch (e) {
      error = "An error occurred while updating the user";
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function addFlag() {
    if (newFlag.trim() && !editForm.flags.includes(newFlag.trim())) {
      editForm.flags = [...editForm.flags, newFlag.trim()];
      newFlag = "";
    }
  }

  function removeFlag(flag: string) {
    editForm.flags = editForm.flags.filter((f) => f !== flag);
  }

  function addRole() {
    if (newRole.trim() && !editForm.roles.includes(newRole.trim())) {
      editForm.roles = [...editForm.roles, newRole.trim()];
      newRole = "";
    }
  }

  function removeRole(role: string) {
    editForm.roles = editForm.roles.filter((r) => r !== role);
  }

  function getFlagBadgeClass(flag: string) {
    if (flag === "blocked") return "badge-error";
    if (flag === "hidden") return "badge-neutral";
    return "badge-warning";
  }

  function getRoleBadgeClass(role: string) {
    const roleColors = {
      admin: "badge-error",
      moderator: "badge-warning",
      user: "badge-info",
      judge: "badge-success",
    };
    return roleColors[role as keyof typeof roleColors] || "badge-primary";
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

  function formatDateTime(dateString: string) {
    return new Date(dateString).toLocaleString();
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

      // Refresh submissions data
      const refreshedData = await api.POST("/admin/submissions/query", {
        body: {
          user_id: [userId],
          offset: 0,
        },
      });
      submissions.r = refreshedData;
    } catch (e) {
      alert(`An error occurred while trying to ${action} the submission`);
      console.error(e);
    }
  }
</script>

<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
  <div
    class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6"
  >
    <div class="flex items-center gap-4">
      <a href="/admin/users" class="btn btn-sm bg-base-100 pop hover:pop">
        <Icon icon="material-symbols:arrow-back" class="text-lg" />
        Back to Users
      </a>
      <h1 class="text-2xl font-bold">User Details</h1>
    </div>
    <div class="flex gap-2">
      {#if editMode}
        <button
          class="btn btn-primary pop hover:pop"
          onclick={saveUser}
          disabled={loading}
        >
          {#if loading}
            <div class="loading loading-spinner loading-xs"></div>
            Saving...
          {:else}
            <Icon icon="material-symbols:save" class="text-lg" />
            Save Changes
          {/if}
        </button>
        <button
          class="btn btn-ghost pop hover:pop"
          onclick={() => (editMode = false)}
        >
          Cancel
        </button>
      {:else}
        <button
          class="btn btn-primary pop hover:pop"
          onclick={() => (editMode = true)}
        >
          <Icon icon="material-symbols:edit" class="text-lg" />
          Edit
        </button>
      {/if}
    </div>
  </div>

  {#if user.loading}
    <div class="flex flex-col items-center gap-4 mt-16">
      <div class="loading loading-spinner loading-lg text-primary"></div>
      <p class="text-center">Loading...</p>
    </div>
  {:else if user.error}
    <div class="alert alert-error pop">
      <Icon icon="material-symbols:error" />
      <span>Failed to load user</span>
    </div>
  {:else if user.r?.data?.data.entries?.[0]}
    {@const userData = user.r.data.data.entries[0]}

    <div class="card bg-base-100 pop rounded-lg w-full">
      <div class="card-body">
        <div class="space-y-6">
          {#if error}
            <div class="alert alert-error pop">
              <Icon icon="material-symbols:error-outline" class="text-2xl" />
              <span>{error}</span>
            </div>
          {/if}

          {#if success}
            <div class="alert alert-success pop">
              <Icon
                icon="material-symbols:check-circle-outline"
                class="text-2xl"
              />
              <span>{success}</span>
            </div>
          {/if}

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Basic Information -->
            <div class="space-y-4">
              <h2 class="text-xl font-bold">Basic Information</h2>

              <div class="form-control w-full">
                <label for="user-id" class="label">
                  <span class="label-text">User ID</span>
                </label>
                <input
                  id="user-id"
                  type="text"
                  value={userData.id}
                  class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0 bg-base-200 text-base-content/70"
                  readonly
                />
              </div>

              <div class="form-control w-full">
                <label for="user-name" class="label">
                  <span class="label-text">Name</span>
                </label>
                {#if editMode}
                  <input
                    id="user-name"
                    type="text"
                    bind:value={editForm.name}
                    class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
                    placeholder="Enter name"
                    required
                  />
                {:else}
                  <input
                    id="user-name"
                    type="text"
                    value={userData.name}
                    class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0 bg-base-200 text-base-content/70"
                    readonly
                  />
                {/if}
              </div>

              <div class="form-control w-full">
                <label for="user-bio" class="label">
                  <span class="label-text">Bio</span>
                </label>
                {#if editMode}
                  <textarea
                    id="user-bio"
                    bind:value={editForm.bio}
                    class="input input-bordered h-32 w-full focus:outline-none focus:ring-0 focus:ring-offset-0 pt-2"
                    placeholder="Enter bio"
                  ></textarea>
                {:else}
                  <textarea
                    id="user-bio"
                    value={userData.bio}
                    class="input input-bordered h-32 w-full focus:outline-none focus:ring-0 focus:ring-offset-0 pt-2 bg-base-200 text-base-content/70"
                    readonly
                  ></textarea>
                {/if}
              </div>

              <div class="form-control w-full">
                <label for="user-created" class="label">
                  <span class="label-text">Created</span>
                </label>
                <input
                  id="user-created"
                  type="text"
                  value={new Date(userData.created_at).toLocaleString()}
                  class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0 bg-base-200 text-base-content/70"
                  readonly
                />
              </div>
            </div>

            <!-- Team Information -->
            <div class="space-y-4">
              <h2 class="text-xl font-bold">Team Information</h2>

              <div class="form-control w-full">
                <label for="user-team" class="label">
                  <span class="label-text">Team</span>
                </label>
                {#if userData.team_id}
                  {#await TeamQueryService.get(userData.team_id)}
                    <input
                      id="user-team"
                      type="text"
                      value="Loading..."
                      class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0 bg-base-200 text-base-content/70"
                      readonly
                    />
                  {:then team}
                    <div class="flex gap-2">
                      <input
                        id="user-team"
                        type="text"
                        value={team?.name || `Team ${userData.team_id}`}
                        class="input input-bordered flex-1 focus:outline-none focus:ring-0 focus:ring-offset-0 bg-base-200 text-base-content/70"
                        readonly
                      />
                      <a
                        href="/admin/team/{userData.team_id}"
                        class="btn btn-outline btn-sm pop hover:pop"
                      >
                        <Icon icon="material-symbols:open-in-new" />
                        View Team
                      </a>
                    </div>
                  {:catch}
                    <input
                      id="user-team"
                      type="text"
                      value={`Team ${userData.team_id}`}
                      class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0 bg-base-200 text-base-content/70"
                      readonly
                    />
                  {/await}
                {:else}
                  <input
                    id="user-team"
                    type="text"
                    value="No team"
                    class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0 bg-base-200 text-base-content/70"
                    readonly
                  />
                {/if}
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- User Flags -->
            <div class="space-y-4">
              <h2 class="text-xl font-bold">User Flags</h2>

              {#if editMode}
                <div class="form-control w-full">
                  <label for="new-flag" class="label">
                    <span class="label-text">Add Flag</span>
                  </label>
                  <div class="flex gap-2">
                    <input
                      id="new-flag"
                      type="text"
                      bind:value={newFlag}
                      class="input input-bordered flex-1 focus:outline-none focus:ring-0 focus:ring-offset-0"
                      placeholder="Enter flag name"
                      onkeydown={(e) => e.key === "Enter" && addFlag()}
                    />
                    <button
                      class="btn btn-primary btn-sm pop hover:pop"
                      onclick={addFlag}>Add</button
                    >
                  </div>
                </div>
              {/if}

              <div
                class="flex gap-2 flex-wrap min-h-[60px] p-3 bg-base-200 rounded-lg"
              >
                {#each editMode ? editForm.flags : userData.flags as flag}
                  <div class="badge {getFlagBadgeClass(flag)} gap-2">
                    {flag}
                    {#if editMode}
                      <button
                        class="btn btn-ghost btn-xs"
                        onclick={() => removeFlag(flag)}
                      >
                        <Icon icon="material-symbols:close" class="text-xs" />
                      </button>
                    {/if}
                  </div>
                {/each}
                {#if (editMode ? editForm.flags : userData.flags).length === 0}
                  <span class="text-base-content/60 w-full text-center"
                    >No flags</span
                  >
                {/if}
              </div>
            </div>

            <!-- Roles -->
            <div class="space-y-4">
              <h2 class="text-xl font-bold">Roles</h2>

              {#if editMode}
                <div class="form-control w-full">
                  <label for="new-role" class="label">
                    <span class="label-text">Add Role</span>
                  </label>
                  <div class="flex gap-2">
                    <input
                      id="new-role"
                      type="text"
                      bind:value={newRole}
                      class="input input-bordered flex-1 focus:outline-none focus:ring-0 focus:ring-offset-0"
                      placeholder="Enter role name"
                      onkeydown={(e) => e.key === "Enter" && addRole()}
                    />
                    <button
                      class="btn btn-primary btn-sm pop hover:pop"
                      onclick={addRole}>Add</button
                    >
                  </div>
                </div>
              {/if}

              <div
                class="flex gap-2 flex-wrap min-h-[60px] p-3 bg-base-200 rounded-lg"
              >
                {#each editMode ? editForm.roles : userData.roles as role}
                  <div class="badge {getRoleBadgeClass(role)} gap-2">
                    {role}
                    {#if editMode}
                      <button
                        class="btn btn-ghost btn-xs"
                        onclick={() => removeRole(role)}
                      >
                        <Icon icon="material-symbols:close" class="text-xs" />
                      </button>
                    {/if}
                  </div>
                {/each}
                {#if (editMode ? editForm.roles : userData.roles).length === 0}
                  <span class="text-base-content/60 w-full text-center"
                    >No roles</span
                  >
                {/if}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Submissions Section -->
    <div class="space-y-4 mt-6">
      <h2 class="text-xl font-bold">Submissions</h2>

      {#if submissions.loading}
        <div class="flex justify-center items-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      {:else if submissions.error}
        <div class="alert alert-error">
          <Icon icon="material-symbols:error" />
          <span>Failed to load submissions</span>
        </div>
      {:else if submissions.r?.data?.data}
        {@const submissionData = submissions.r.data.data.entries}

        {#if submissionData.length > 0}
          <SubmissionsTable
            submissions={submissionData}
            {challengeMap}
            showUser={false}
            showTeam={false}
            showActions={true}
            variant="compact"
            onVisibilityToggle={toggleSubmissionVisibility}
          />

          <div class="text-sm text-base-content/70 text-center">
            Showing {submissionData.length} submission{submissionData.length !==
            1
              ? "s"
              : ""}
          </div>
        {:else}
          <div
            class="flex flex-col items-center justify-center py-8 text-base-content/70"
          >
            <Icon
              icon="material-symbols:assignment-outline"
              class="text-5xl mb-2"
            />
            <p class="text-lg font-medium">No submissions yet</p>
            <p class="text-sm">This user hasn't made any submissions</p>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>
