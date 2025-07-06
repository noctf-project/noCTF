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

  const availableFlags = [
    { name: "blocked", color: "btn-error", icon: "material-symbols:block" },
    {
      name: "hidden",
      color: "btn-neutral",
      icon: "material-symbols:visibility-off",
    },
  ];

  const availableRoles = [
    {
      name: "admin",
      color: "btn-error",
      icon: "material-symbols:admin-panel-settings",
    },
  ];

  let customFlagInput = $state("");
  let customRoleInput = $state("");

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
      // TODO: Replace with actual API call when endpoint exists

      success = "User updated successfully! (placeholder)";
      editMode = false;

      if (user.r?.data?.data.entries?.[0]) {
        user.r.data.data.entries[0] = {
          ...user.r.data.data.entries[0],
          name: editForm.name,
          bio: editForm.bio,
          flags: [...editForm.flags],
          roles: [...editForm.roles],
        };
      }
    } catch (e) {
      error = "An error occurred while updating the user";
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function toggleFlagSelection(flagName: string) {
    if (editForm.flags.includes(flagName)) {
      editForm.flags = editForm.flags.filter((flag) => flag !== flagName);
    } else {
      editForm.flags = [...editForm.flags, flagName];
    }
  }

  function toggleRoleSelection(roleName: string) {
    if (editForm.roles.includes(roleName)) {
      editForm.roles = editForm.roles.filter((role) => role !== roleName);
    } else {
      editForm.roles = [...editForm.roles, roleName];
    }
  }

  function addCustomFlag() {
    const flagName = customFlagInput.trim();
    if (flagName && !editForm.flags.includes(flagName)) {
      editForm.flags = [...editForm.flags, flagName];
      customFlagInput = "";
    }
  }

  function addCustomRole() {
    const roleName = customRoleInput.trim();
    if (roleName && !editForm.roles.includes(roleName)) {
      editForm.roles = [...editForm.roles, roleName];
      customRoleInput = "";
    }
  }

  function removeCustomFlag(flagName: string) {
    editForm.flags = editForm.flags.filter((flag) => flag !== flagName);
  }

  function removeCustomRole(roleName: string) {
    editForm.roles = editForm.roles.filter((role) => role !== roleName);
  }

  const predefinedFlagNames = $derived(availableFlags.map((f) => f.name));
  const predefinedRoleNames = $derived(availableRoles.map((r) => r.name));
  const customFlags = $derived(
    editForm.flags.filter((flag) => !predefinedFlagNames.includes(flag)),
  );
  const customRoles = $derived(
    editForm.roles.filter((role) => !predefinedRoleNames.includes(role)),
  );

  function getFlagConfig(flagName: string) {
    const predefinedFlag = availableFlags.find((f) => f.name === flagName);
    return (
      predefinedFlag || { name: flagName, color: "badge-warning", icon: null }
    );
  }

  function getRoleConfig(roleName: string) {
    const predefinedRole = availableRoles.find((r) => r.name === roleName);
    return (
      predefinedRole || { name: roleName, color: "badge-primary", icon: null }
    );
  }

  function getProviderIcon(provider: string) {
    const providerIcons = {
      email: "material-symbols:alternate-email",
      discord: "mdi:discord",
    };
    return (
      providerIcons[provider as keyof typeof providerIcons] ||
      "material-symbols:account-circle"
    );
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
          class="btn bg-base-100 pop hover:pop"
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
            <div class="space-y-4">
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
                    <div class="flex items-center gap-2">
                      <input
                        id="user-team"
                        type="text"
                        value={team?.name || `Team ${userData.team_id}`}
                        class="input input-bordered flex-1 focus:outline-none focus:ring-0 focus:ring-offset-0 bg-base-200 text-base-content/70"
                        readonly
                      />
                      <a
                        href="/admin/team/{userData.team_id}"
                        class="btn bg-base-100 btn-sm pop hover:pop"
                      >
                        <Icon icon="material-symbols:open-in-new" />
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
            <div class="space-y-4">
              <div class="form-control w-full">
                <label for="user-identities" class="label">
                  <span class="label-text">Identities</span>
                </label>
                <div
                  class="flex gap-2 flex-wrap min-h-[60px] p-3 bg-base-200 rounded-lg"
                >
                  {#if userData.identities && userData.identities.length > 0}
                    {#each userData.identities as identity}
                      <div class="badge badge-info gap-2 pop">
                        <Icon
                          icon={getProviderIcon(identity.provider)}
                          class="text-sm"
                        />
                        <span class="font-medium">{identity.provider}</span>
                        <span class="opacity-70">•</span>
                        <span class="font-mono text-xs"
                          >{identity.provider_id}</span
                        >
                      </div>
                    {/each}
                  {:else}
                    <span class="text-base-content/60 w-full text-center"
                      >No identities</span
                    >
                  {/if}
                </div>
                {#if userData.identities && userData.identities.length > 0}
                  <div class="text-xs opacity-70 mt-1">
                    {userData.identities.length} identity{userData.identities
                      .length !== 1
                      ? "ies"
                      : "y"}
                  </div>
                {/if}
              </div>

              <div class="form-control w-full">
                <label class="label" for="user-flags">
                  <span class="label-text">User Flags</span>
                </label>

                {#if editMode}
                  <div
                    class="flex flex-wrap gap-2 p-3 bg-base-200 rounded-lg min-h-[60px]"
                  >
                    {#each availableFlags as flag}
                      {@const isSelected = editForm.flags.includes(flag.name)}
                      <label class="cursor-pointer">
                        <input
                          type="checkbox"
                          class="sr-only"
                          checked={isSelected}
                          onchange={() => toggleFlagSelection(flag.name)}
                        />
                        <div
                          class={`btn btn-sm ${isSelected ? `${flag.color} text-white` : "btn-outline bg-base-100"} pop hover:pop`}
                        >
                          {#if isSelected}
                            <Icon icon={flag.icon} class="text-sm" />
                          {/if}
                          {flag.name}
                        </div>
                      </label>
                    {/each}

                    {#each customFlags as flagName}
                      <div
                        class="btn btn-sm badge-warning text-white pop relative group"
                      >
                        {flagName}
                        <button
                          type="button"
                          class="ml-1 opacity-60 hover:opacity-100"
                          onclick={() => removeCustomFlag(flagName)}
                          title="Remove custom flag"
                        >
                          <Icon icon="material-symbols:close" class="text-xs" />
                        </button>
                      </div>
                    {/each}
                  </div>

                  <div class="mt-2">
                    <div class="text-sm font-medium mb-2 opacity-70">
                      Add Custom Flag
                    </div>
                    <div class="flex gap-2">
                      <input
                        type="text"
                        bind:value={customFlagInput}
                        placeholder="Enter custom flag name"
                        class="input input-bordered h-8 flex-1 focus:outline-none focus:ring-0 focus:ring-offset-0"
                        onkeydown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomFlag();
                          }
                        }}
                      />
                      <button
                        type="button"
                        class="btn btn-primary btn-sm pop hover:pop h-8 min-h-8"
                        onclick={addCustomFlag}
                        disabled={!customFlagInput.trim() ||
                          editForm.flags.includes(customFlagInput.trim())}
                      >
                        <Icon icon="material-symbols:add" class="text-sm" />
                        Add
                      </button>
                    </div>
                  </div>

                  <div class="text-xs opacity-70 mt-1 h-2">
                    {#if editForm.flags.length > 0}
                      {editForm.flags.length} flag{editForm.flags.length !== 1
                        ? "s"
                        : ""} selected
                    {/if}
                  </div>
                {:else}
                  <div
                    class="flex gap-2 flex-wrap min-h-[60px] p-3 bg-base-200 rounded-lg"
                  >
                    {#if userData.flags && userData.flags.length > 0}
                      {#each userData.flags as flagName}
                        {@const flagConfig = getFlagConfig(flagName)}
                        {@const isCustomFlag =
                          !predefinedFlagNames.includes(flagName)}
                        <div
                          class="btn btn-sm {flagConfig.color} text-white pop pointer-events-none"
                        >
                          {#if flagConfig.icon}
                            <Icon icon={flagConfig.icon} class="text-sm" />
                          {/if}
                          {flagName}
                          {#if isCustomFlag}
                            <span class="ml-1 opacity-60 text-xs">(custom)</span
                            >
                          {/if}
                        </div>
                      {/each}
                    {:else}
                      <span class="text-base-content/60 w-full text-center"
                        >No flags</span
                      >
                    {/if}
                  </div>
                {/if}
              </div>

              <div class="form-control w-full">
                <label class="label" for="roles">
                  <span class="label-text">Roles</span>
                </label>

                {#if editMode}
                  <div
                    class="flex flex-wrap gap-2 p-3 bg-base-200 rounded-lg min-h-[60px]"
                  >
                    {#each availableRoles as role}
                      {@const isSelected = editForm.roles.includes(role.name)}
                      <label class="cursor-pointer">
                        <input
                          type="checkbox"
                          class="sr-only"
                          checked={isSelected}
                          onchange={() => toggleRoleSelection(role.name)}
                        />
                        <div
                          class={`btn btn-sm ${isSelected ? `${role.color} text-white` : "btn-outline bg-base-100"} pop hover:pop`}
                        >
                          {#if isSelected}
                            <Icon icon={role.icon} class="text-sm" />
                          {/if}
                          {role.name}
                        </div>
                      </label>
                    {/each}

                    {#each customRoles as roleName}
                      <div
                        class="btn btn-sm badge-primary text-white pop relative group"
                      >
                        {roleName}
                        <button
                          type="button"
                          class="ml-1 opacity-60 hover:opacity-100"
                          onclick={() => removeCustomRole(roleName)}
                          title="Remove custom role"
                        >
                          <Icon icon="material-symbols:close" class="text-xs" />
                        </button>
                      </div>
                    {/each}
                  </div>

                  <div class="mt-2">
                    <div class="text-sm font-medium mb-2 opacity-70">
                      Add Custom Role
                    </div>
                    <div class="flex gap-2">
                      <input
                        type="text"
                        bind:value={customRoleInput}
                        placeholder="Enter custom role name"
                        class="input input-bordered h-8 flex-1 focus:outline-none focus:ring-0 focus:ring-offset-0"
                        onkeydown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomRole();
                          }
                        }}
                      />
                      <button
                        type="button"
                        class="btn btn-primary btn-sm pop hover:pop h-8 min-h-8"
                        onclick={addCustomRole}
                        disabled={!customRoleInput.trim() ||
                          editForm.roles.includes(customRoleInput.trim())}
                      >
                        <Icon icon="material-symbols:add" class="text-sm" />
                        Add
                      </button>
                    </div>
                  </div>

                  <div class="text-xs opacity-70 mt-1 h-2">
                    {#if editForm.roles.length > 0}
                      {editForm.roles.length} role{editForm.roles.length !== 1
                        ? "s"
                        : ""} selected
                    {/if}
                  </div>
                {:else}
                  <div
                    class="flex gap-2 flex-wrap min-h-[60px] p-3 bg-base-200 rounded-lg"
                  >
                    {#if userData.roles && userData.roles.length > 0}
                      {#each userData.roles as roleName}
                        {@const roleConfig = getRoleConfig(roleName)}
                        {@const isCustomRole =
                          !predefinedRoleNames.includes(roleName)}
                        <div
                          class="btn btn-sm {roleConfig.color} text-white pop pointer-events-none"
                        >
                          {#if roleConfig.icon}
                            <Icon icon={roleConfig.icon} class="text-sm" />
                          {/if}
                          {roleName}
                          {#if isCustomRole}
                            <span class="ml-1 opacity-60 text-xs">(custom)</span
                            >
                          {/if}
                        </div>
                      {/each}
                    {:else}
                      <span class="text-base-content/60 w-full text-center"
                        >No roles</span
                      >
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

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
