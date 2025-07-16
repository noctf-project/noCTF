<script lang="ts">
  import { page } from "$app/state";
  import Icon from "@iconify/svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import {
    countryCodeToFlag,
    countryCodeToName,
    AllCountries,
  } from "$lib/utils/country";
  import UserQueryService from "$lib/state/user_query.svelte";
  import SubmissionsTable from "$lib/components/SubmissionsTable.svelte";
  import { goto } from "$app/navigation";
  import { availableFlags, getFlagConfig } from "$lib/utils/team-flags";

  import { toasts } from "$lib/stores/toast";
  import UserSearch from "$lib/components/UserSearch.svelte";

  const teamId = Number(page.params.id);

  const team = wrapLoadable(
    api.POST("/admin/teams/query", {
      body: { ids: [teamId] },
    }),
  );

  const submissions = wrapLoadable(
    api.POST("/admin/submissions/query", {
      body: {
        team_id: [teamId],
        page_size: 100,
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

  $effect(() => {
    if (team.r?.data?.data.entries?.[0]?.members) {
      const teamData = team.r.data.data.entries[0];
      teamData.members.forEach((member) => {
        UserQueryService.get(member.user_id).catch(() => {});
      });
    }
  });

  $effect(() => {
    if (submissions.r?.data?.data) {
      const submissionData = submissions.r.data.data.entries;
      submissionData.forEach((submission) => {
        if (submission.user_id) {
          UserQueryService.get(submission.user_id).catch(() => {});
        }
      });
    }
  });

  let editMode = $state(false);
  let loading = $state(false);
  let error = $state("");

  let editForm = $state({
    name: "",
    bio: "",
    country: "",
    division_id: null as number | null,
    tag_ids: [] as number[],
    flags: [] as string[],
  });

  type TeamTag = {
    id: number;
    name: string;
    is_joinable: boolean;
  };

  type AdminUser = {
    id: number;
    name: string;
    bio: string;
    created_at: string;
    identities?: Array<{
      provider: string;
      provider_id: string;
    }>;
  };

  const apiTeamTags = wrapLoadable(api.GET("/team_tags"));
  const teamTags: TeamTag[] = $derived(apiTeamTags.r?.data?.data?.tags || []);

  const apiDivisions = wrapLoadable(api.GET("/divisions"));
  const divisions = $derived(apiDivisions.r?.data?.data || []);

  $effect(() => {
    if (team.r?.data?.data.entries?.[0]) {
      const teamData = team.r.data.data.entries[0];
      editForm = {
        name: teamData.name,
        bio: teamData.bio,
        country: teamData.country || "",
        division_id: teamData.division_id,
        tag_ids: teamData.tag_ids || [],
        flags: teamData.flags || [],
      };
    }
  });

  async function saveTeam() {
    loading = true;
    error = "";

    try {
      const result = await api.PUT("/admin/teams/{id}", {
        params: { path: { id: teamId } },
        body: {
          name: editForm.name,
          bio: editForm.bio,
          country: editForm.country || null,
          division_id: editForm.division_id || 1,
          tag_ids: editForm.tag_ids,
          flags: editForm.flags,
        },
      });

      if (result.error) {
        error = "Failed to update team";
        return;
      }

      toasts.success("Team updated successfully!");
      editMode = false;

      const refreshedData = await api.POST("/admin/teams/query", {
        body: { ids: [teamId] },
      });
      team.r = refreshedData;
    } catch (e) {
      error = "An error occurred while updating the team";
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function formatDateTime(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  function toggleTagSelection(tagId: number) {
    if (editForm.tag_ids.includes(tagId)) {
      editForm.tag_ids = editForm.tag_ids.filter((id) => id !== tagId);
    } else {
      editForm.tag_ids = [...editForm.tag_ids, tagId];
    }
  }

  function toggleFlagSelection(flagName: string) {
    if (editForm.flags.includes(flagName)) {
      editForm.flags = editForm.flags.filter((flag) => flag !== flagName);
    } else {
      editForm.flags = [...editForm.flags, flagName];
    }
  }

  let customFlagInput = $state("");

  function addCustomFlag() {
    const flagName = customFlagInput.trim();
    if (flagName && !editForm.flags.includes(flagName)) {
      editForm.flags = [...editForm.flags, flagName];
      customFlagInput = "";
    }
  }

  function removeCustomFlag(flagName: string) {
    editForm.flags = editForm.flags.filter((flag) => flag !== flagName);
  }

  const predefinedFlagNames = $derived(availableFlags.map((f) => f.name));
  const customFlags = $derived(
    editForm.flags.filter((flag) => !predefinedFlagNames.includes(flag)),
  );

  async function deleteTeam() {
    const confirmed = confirm(
      `Are you sure you want to delete this team? This action cannot be undone.`,
    );

    if (!confirmed) return;

    loading = true;
    error = "";

    try {
      const result = await api.DELETE("/admin/teams/{id}", {
        params: { path: { id: teamId } },
      });

      if (result.error) {
        error = "Failed to delete team";
        return;
      }

      goto("/admin/teams");
    } catch (e) {
      error = "An error occurred while deleting the team";
      console.error(e);
    } finally {
      loading = false;
    }
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
        toasts.error(`Failed to ${action} submission`);
        return;
      }

      const refreshedData = await api.POST("/admin/submissions/query", {
        body: {
          team_id: [teamId],
          page_size: 100,
        },
      });
      submissions.r = refreshedData;
    } catch (e) {
      toasts.error(
        `An error occurred while trying to ${action} the submission`,
      );
      console.error(e);
    }
  }

  async function removeMember(userId: number, userName: string) {
    const confirmed = confirm(
      `Are you sure you want to remove ${userName} from this team? This action cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      const result = await api.PUT("/admin/teams/{id}/members", {
        params: { path: { id: teamId } },
        body: {
          user_id: userId,
          role: "none",
        },
      });

      if (result.error) {
        toasts.error(result.error.message || "Failed to remove member");
        return;
      }

      const refreshedData = await api.POST("/admin/teams/query", {
        body: { ids: [teamId] },
      });
      team.r = refreshedData;
    } catch (e) {
      const errorMessage =
        e instanceof Error
          ? e.message
          : "An error occurred while removing the member";
      toasts.error(errorMessage);
      console.error(e);
    }
  }

  async function transferOwnership(userId: number, userName: string) {
    const confirmed = confirm(
      `Are you sure you want to transfer ownership to ${userName}? This will make them the team owner and demote the current owner to a regular member.`,
    );

    if (!confirmed) return;

    try {
      const result = await api.PUT("/admin/teams/{id}/members", {
        params: { path: { id: teamId } },
        body: {
          user_id: userId,
          role: "owner",
        },
      });

      if (result.error) {
        toasts.error(result.error.message || "Failed to transfer ownership");
        return;
      }

      const refreshedData = await api.POST("/admin/teams/query", {
        body: { ids: [teamId] },
      });
      team.r = refreshedData;
    } catch (e) {
      const errorMessage =
        e instanceof Error
          ? e.message
          : "An error occurred while transferring ownership";
      toasts.error(errorMessage);
      console.error(e);
    }
  }

  let showUserSearch = $state(false);

  async function addUserToTeam(user: AdminUser) {
    const confirmed = confirm(
      `Are you sure you want to add ${user.name} (ID: ${user.id}) to this team as a member?`,
    );

    if (!confirmed) return;

    try {
      const result = await api.PUT("/admin/teams/{id}/members", {
        params: { path: { id: teamId } },
        body: {
          user_id: user.id,
          role: "member",
        },
      });

      if (result.error) {
        toasts.error(result.error.message || "Failed to add user to team");
        return;
      }

      const refreshedData = await api.POST("/admin/teams/query", {
        body: { ids: [teamId] },
      });
      team.r = refreshedData;

      showUserSearch = false;
    } catch (e) {
      const errorMessage =
        e instanceof Error
          ? e.message
          : "An error occurred while adding the user to the team";
      toasts.error(errorMessage);
      console.error(e);
    }
  }
</script>

<div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
  <div
    class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6"
  >
    <div class="flex items-center gap-4">
      <a href="/admin/teams" class="btn btn-sm bg-base-100 pop hover:pop">
        <Icon icon="material-symbols:arrow-back" class="text-lg" />
        Back to Teams
      </a>
      <h1 class="text-2xl font-bold">Team Details</h1>
    </div>
    <div class="flex gap-2">
      {#if editMode}
        <button
          class="btn btn-primary pop hover:pop"
          onclick={saveTeam}
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
        <button
          class="btn btn-error pop hover:pop"
          onclick={deleteTeam}
          disabled={loading}
        >
          {#if loading}
            <div class="loading loading-spinner loading-xs"></div>
            Deleting...
          {:else}
            <Icon icon="material-symbols:delete" class="text-lg" />
            Delete
          {/if}
        </button>
      {/if}
    </div>
  </div>

  {#if team.loading}
    <div class="flex flex-col items-center gap-4 mt-16">
      <div class="loading loading-spinner loading-lg text-primary"></div>
      <p class="text-center">Loading...</p>
    </div>
  {:else if team.error}
    <div class="alert alert-error pop">
      <Icon icon="material-symbols:error" />
      <span>Failed to load team</span>
    </div>
  {:else if team.r?.data?.data.entries?.[0]}
    {@const teamData = team.r.data.data.entries[0]}

    <div class="card bg-base-100 pop rounded-lg w-full">
      <div class="card-body">
        <div class="space-y-6">
          {#if error}
            <div class="alert alert-error pop">
              <Icon icon="material-symbols:error-outline" class="text-2xl" />
              <span>{error}</span>
            </div>
          {/if}

          <!-- Team Header -->
          <div
            class="flex flex-col items-center gap-4 p-6 bg-base-200 rounded-lg"
          >
            <div class="flex flex-row items-center gap-4">
              {#if teamData.country}
                <div
                  class="text-3xl"
                  title={countryCodeToName(teamData.country)}
                >
                  {countryCodeToFlag(teamData.country)}
                </div>
              {/if}
              <span class="text-3xl font-bold">{teamData.name}</span>
            </div>
            <p class="text-lg italic text-center">{teamData.bio}</p>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Basic Information -->
            <div class="space-y-4">
              <h2 class="text-xl font-bold">Basic Information</h2>

              <div class="form-control w-full">
                <label for="team-id" class="label">
                  <span class="label-text">Team ID</span>
                </label>
                <input
                  id="team-id"
                  type="text"
                  value={teamData.id}
                  class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0 bg-base-200 text-base-content/70"
                  readonly
                />
              </div>

              <div class="form-control w-full">
                <label for="team-name" class="label">
                  <span class="label-text">Team Name</span>
                </label>
                {#if editMode}
                  <input
                    id="team-name"
                    type="text"
                    bind:value={editForm.name}
                    class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
                    placeholder="Enter team name"
                    required
                    minlength="1"
                    maxlength="64"
                  />
                {:else}
                  <input
                    id="team-name"
                    type="text"
                    value={teamData.name}
                    class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0 bg-base-200 text-base-content/70"
                    readonly
                  />
                {/if}
              </div>

              <div class="form-control w-full">
                <label for="team-bio" class="label">
                  <span class="label-text">Team Bio</span>
                </label>
                {#if editMode}
                  <textarea
                    id="team-bio"
                    bind:value={editForm.bio}
                    class="input input-bordered h-32 w-full focus:outline-none focus:ring-0 focus:ring-offset-0 pt-2"
                    placeholder="Describe your team..."
                    maxlength="256"
                  ></textarea>
                  <span class="label-text-alt text-right mt-1"
                    >{editForm.bio.length}/256</span
                  >
                {:else}
                  <textarea
                    id="team-bio"
                    value={teamData.bio}
                    class="input input-bordered h-32 w-full focus:outline-none focus:ring-0 focus:ring-offset-0 pt-2 bg-base-200 text-base-content/70"
                    readonly
                  ></textarea>
                {/if}
              </div>

              <div class="form-control w-full">
                <label for="team-country" class="label">
                  <span class="label-text">Country</span>
                </label>
                {#if editMode}
                  <select
                    id="team-country"
                    bind:value={editForm.country}
                    class="select select-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
                  >
                    <option value="">No country selected</option>
                    {#each Object.keys(AllCountries || {}) as countryCode}
                      <option value={countryCode}>
                        {countryCodeToFlag(countryCode)}
                        {AllCountries[countryCode]}
                      </option>
                    {/each}
                  </select>
                {:else}
                  <div
                    class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0 flex items-center bg-base-200 text-base-content/70"
                  >
                    {#if teamData.country}
                      <span class="text-lg mr-2"
                        >{countryCodeToFlag(teamData.country)}</span
                      >
                      {countryCodeToName(teamData.country)}
                    {:else}
                      No country
                    {/if}
                  </div>
                {/if}
              </div>

              <div class="form-control w-full">
                <label for="team-created" class="label">
                  <span class="label-text">Created</span>
                </label>
                <input
                  id="team-created"
                  type="text"
                  value={formatDateTime(teamData.created_at)}
                  class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0 bg-base-200 text-base-content/70"
                  readonly
                />
              </div>
            </div>

            <!-- Team Details -->
            <div class="space-y-4">
              <h2 class="text-xl font-bold">Team Details</h2>

              <div class="form-control w-full">
                <label for="team-division" class="label">
                  <span class="label-text">Division</span>
                </label>
                {#if editMode}
                  <select
                    id="team-division"
                    bind:value={editForm.division_id}
                    class="select select-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
                  >
                    {#if apiDivisions.loading}
                      <option disabled>Loading divisions...</option>
                    {:else}
                      {#each divisions as division}
                        <option value={division.id}>
                          {division.name}
                        </option>
                      {/each}
                    {/if}
                  </select>
                {:else}
                  <input
                    id="team-division"
                    type="text"
                    value={teamData.division_id
                      ? divisions.find((d) => d.id === teamData.division_id)
                          ?.name || `Division ${teamData.division_id}`
                      : "No division"}
                    class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0 bg-base-200 text-base-content/70"
                    readonly
                  />
                {/if}
              </div>

              <div class="form-control w-full">
                <label for="team-members" class="label">
                  <span class="label-text">Member Count</span>
                </label>
                <input
                  id="team-members"
                  type="text"
                  value={teamData.members?.length || 0}
                  class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0 bg-base-200 text-base-content/70"
                  readonly
                />
              </div>

              <div class="form-control w-full">
                <label for="team-tags" class="label">
                  <span class="label-text">Tags</span>
                </label>
                {#if editMode}
                  <div
                    class="flex flex-wrap gap-2 p-3 bg-base-200 rounded-lg min-h-[60px]"
                  >
                    {#if apiTeamTags.loading}
                      {#each Array(3) as _}
                        <div class="skeleton h-8 w-20"></div>
                      {/each}
                    {:else if teamTags.length === 0}
                      <div class="text-sm opacity-70 w-full text-center">
                        No tags available
                      </div>
                    {:else}
                      {#each teamTags as tag}
                        {@const isSelected = editForm.tag_ids.includes(tag.id)}
                        <label class="cursor-pointer">
                          <input
                            type="checkbox"
                            class="sr-only"
                            checked={isSelected}
                            onchange={() => toggleTagSelection(tag.id)}
                          />
                          <div
                            class={`btn btn-sm ${isSelected ? "btn-primary" : "btn-outline bg-base-100"} pop hover:pop`}
                          >
                            {#if isSelected}
                              <Icon
                                icon="material-symbols:check"
                                class="text-sm"
                              />
                            {/if}
                            {tag.name}
                          </div>
                        </label>
                      {/each}
                    {/if}
                  </div>
                  <div class="text-xs opacity-70 mt-1 h-2">
                    {#if editForm.tag_ids.length > 0}
                      {editForm.tag_ids.length} tag{editForm.tag_ids.length !==
                      1
                        ? "s"
                        : ""} selected
                    {/if}
                  </div>
                {:else}
                  <div
                    class="flex gap-2 flex-wrap min-h-[60px] p-3 bg-base-200 rounded-lg"
                  >
                    {#if teamData.tag_ids && teamData.tag_ids.length > 0}
                      {#each teamData.tag_ids as tagId}
                        {@const tag = teamTags.find((t) => t.id === tagId)}
                        <div
                          class="btn btn-sm btn-primary pop pointer-events-none"
                        >
                          <Icon icon="material-symbols:check" class="text-sm" />
                          {tag?.name || `Tag ${tagId}`}
                        </div>
                      {/each}
                    {:else}
                      <span class="text-base-content/60 w-full text-center"
                        >No tags</span
                      >
                    {/if}
                  </div>
                {/if}
              </div>

              <div class="form-control w-full">
                <label for="team-flags" class="label">
                  <span class="label-text">Flags</span>
                </label>
                {#if editMode}
                  <!-- All Flags Container -->
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

                  <!-- Add Custom Flag Input -->
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
                    {#if teamData.flags && teamData.flags.length > 0}
                      {#each teamData.flags as flagName}
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
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Members Section -->
    <div class="space-y-4 mt-8">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-bold">
          Members ({teamData.members?.length || 0})
        </h2>
        <button
          class="btn btn-primary pop hover:pop"
          onclick={() => (showUserSearch = !showUserSearch)}
        >
          <Icon
            icon={showUserSearch
              ? "material-symbols:close"
              : "material-symbols:person-add"}
            class="text-lg"
          />
          {showUserSearch ? "Cancel" : "Add User"}
        </button>
      </div>

      {#if showUserSearch}
        <UserSearch
          onUserSelect={addUserToTeam}
          placeholder="Enter user name to search..."
          showBio={true}
          showCreatedAt={true}
          buttonText="Add to Team"
          excludedUserIds={teamData.members?.map((m) => m.user_id) || []}
        />
      {/if}

      {#if teamData.members && teamData.members.length > 0}
        <div
          class="pop border border-base-500 bg-base-100 rounded-lg overflow-x-auto"
        >
          <table class="w-full border-collapse">
            <thead>
              <tr>
                <th
                  class="border-y border-base-300 bg-base-200 py-2 px-3 text-left font-bold"
                  >User</th
                >
                <th
                  class="border-y border-base-300 bg-base-200 py-2 px-3 text-left font-bold"
                  >Role</th
                >
                <th
                  class="border-y border-base-300 bg-base-200 py-2 px-3 text-right font-bold"
                  >Actions</th
                >
              </tr>
            </thead>
            <tbody>
              {#each teamData.members as member}
                <tr class="bg-base-100 hover:bg-base-300/30">
                  <td class="border-y border-base-300 py-2 px-3">
                    {#await UserQueryService.get(member.user_id)}
                      <span class="text-base-content/60"
                        >User {member.user_id}</span
                      >
                    {:then user}
                      <div class="flex flex-col">
                        <span class="font-medium"
                          >{user?.name || `User ${member.user_id}`}</span
                        >
                        <span class="text-sm text-base-content/60 font-mono"
                          >ID: {member.user_id}</span
                        >
                      </div>
                    {:catch}
                      <span class="text-base-content/60"
                        >User {member.user_id}</span
                      >
                    {/await}
                  </td>
                  <td class="border-y border-base-300 py-2 px-3">
                    <span
                      class="badge pop {member.role === 'owner'
                        ? 'badge-primary'
                        : 'badge-secondary'}"
                    >
                      {#if member.role === "owner"}
                        <Icon icon="material-symbols:crown" class="text-xs" />
                      {:else}
                        <Icon icon="material-symbols:person" class="text-xs" />
                      {/if}
                      &nbsp;
                      {member.role}
                    </span>
                  </td>
                  <td class="border-y border-base-300 py-2 px-3 text-right">
                    <div class="flex gap-2 justify-end">
                      <a
                        href="/admin/user/{member.user_id}"
                        class="btn bg-base-100 btn-xs pop hover:pop"
                      >
                        <Icon icon="material-symbols:open-in-new" />
                        View User
                      </a>
                      {#if member.role !== "owner"}
                        <button
                          class="btn btn-primary btn-xs pop hover:pop"
                          onclick={() => {
                            UserQueryService.get(member.user_id).then(
                              (user) => {
                                transferOwnership(
                                  member.user_id,
                                  user?.name || `User ${member.user_id}`,
                                );
                              },
                            );
                          }}
                        >
                          <Icon icon="material-symbols:crown" />
                          Make Owner
                        </button>
                      {/if}
                      <button
                        class="btn btn-error btn-xs pop hover:pop"
                        onclick={() => {
                          UserQueryService.get(member.user_id).then((user) => {
                            removeMember(
                              member.user_id,
                              user?.name || `User ${member.user_id}`,
                            );
                          });
                        }}
                      >
                        <Icon icon="material-symbols:person-remove" />
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div
          class="flex flex-col items-center justify-center py-8 text-base-content/70"
        >
          <Icon icon="material-symbols:group" class="text-5xl mb-2" />
          <p class="text-lg font-medium">No members yet</p>
          <p class="text-sm">This team doesn't have any members</p>
        </div>
      {/if}
    </div>

    <!-- Submissions Section -->
    <div class="space-y-4 mt-8">
      <h2 class="text-xl font-bold">Team Submissions</h2>

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
            showUser={true}
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
            <p class="text-sm">This team hasn't made any submissions</p>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>
