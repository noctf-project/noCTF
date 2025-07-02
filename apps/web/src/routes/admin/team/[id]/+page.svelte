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

  const teamId = Number(page.params.id);

  const team = wrapLoadable(
    api.POST("/teams/query", {
      body: { ids: [teamId] },
    }),
  );

  const submissions = wrapLoadable(
    api.POST("/admin/submissions/query", {
      body: { 
        team_id: [teamId],
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

  // Preload user data for team members
  $effect(() => {
    if (team.r?.data?.data.entries?.[0]?.members) {
      const teamData = team.r.data.data.entries[0];
      teamData.members.forEach((member) => {
        UserQueryService.get(member.user_id).catch(() => {
          // Ignore errors for preloading
        });
      });
    }
  });

  // Preload user data for submission authors
  $effect(() => {
    if (submissions.r?.data?.data) {
      const submissionData = submissions.r.data.data.entries;
      submissionData.forEach((submission) => {
        if (submission.user_id) {
          UserQueryService.get(submission.user_id).catch(() => {
            // Ignore errors for preloading
          });
        }
      });
    }
  });

  let editMode = $state(false);
  let loading = $state(false);
  let error = $state("");
  let success = $state("");

  let editForm = $state({
    name: "",
    bio: "",
    country: "",
    tag_ids: [] as number[],
  });

  type TeamTag = {
    id: number;
    name: string;
    is_joinable: boolean;
  };

  const apiTeamTags = wrapLoadable(api.GET("/team_tags"));
  const teamTags: TeamTag[] = $derived(apiTeamTags.r?.data?.data?.tags || []);

  $effect(() => {
    if (team.r?.data?.data.entries?.[0]) {
      const teamData = team.r.data.data.entries[0];
      editForm = {
        name: teamData.name,
        bio: teamData.bio,
        country: teamData.country || "",
        tag_ids: teamData.tag_ids || [],
      };
    }
  });

  async function saveTeam() {
    loading = true;
    error = "";
    success = "";

    try {
      const result = await api.PUT("/teams/{id}", {
        params: { path: { id: teamId } },
        body: {
          name: editForm.name,
          bio: editForm.bio,
          country: editForm.country || null,
          tag_ids: editForm.tag_ids,
        },
      });

      if (result.error) {
        error = "Failed to update team";
        return;
      }

      success = "Team updated successfully!";
      editMode = false;

      // Refresh team data
      const refreshedData = await api.POST("/teams/query", {
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

  function getSubmissionStatusBadgeClass(status: string) {
    const statusColors = {
      "correct": "badge-success",
      "incorrect": "badge-error",
      "queued": "badge-warning",
      "invalid": "badge-neutral",
    };
    return statusColors[status as keyof typeof statusColors] || "badge-info";
  }

  async function toggleSubmissionVisibility(submissionId: number, currentlyHidden: boolean) {
    const action = currentlyHidden ? "unhide" : "hide";
    const confirmed = confirm(`Are you sure you want to ${action} this submission?`);
    
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
          team_id: [teamId],
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

          {#if success}
            <div class="alert alert-success pop">
              <Icon
                icon="material-symbols:check-circle-outline"
                class="text-2xl"
              />
              <span>{success}</span>
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
                <input
                  id="team-division"
                  type="text"
                  value={teamData.division_id
                    ? `Division ${teamData.division_id}`
                    : "No division"}
                  class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0 bg-base-200 text-base-content/70"
                  readonly
                />
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
                        <span class="badge badge-outline"
                          >{tag?.name || `Tag ${tagId}`}</span
                        >
                      {/each}
                    {:else}
                      <span class="text-base-content/60 w-full text-center"
                        >No tags</span
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
    {#if teamData.members && teamData.members.length > 0}
      <div class="space-y-4 mt-8">
        <h2 class="text-xl font-bold">Members ({teamData.members.length})</h2>

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
                  class="border-y border-base-300 bg-base-200 py-2 px-3 text-center font-bold"
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
                      class="badge {member.role === 'owner'
                        ? 'badge-primary'
                        : 'badge-secondary'}"
                    >
                      {member.role}
                    </span>
                  </td>
                  <td class="border-y border-base-300 py-2 px-3 text-center">
                    <a
                      href="/admin/user/{member.user_id}"
                      class="btn btn-ghost btn-xs pop hover:pop"
                    >
                      <Icon icon="material-symbols:open-in-new" />
                      View User
                    </a>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

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
          <div class="pop border border-base-500 bg-base-100 rounded-lg overflow-x-auto">
            <table class="w-full border-collapse">
              <thead>
                <tr>
                  <th class="border-y border-base-300 bg-base-200 py-2 px-3 text-left font-bold">ID</th>
                  <th class="border-y border-base-300 bg-base-200 py-2 px-3 text-left font-bold">Challenge</th>
                  <th class="border-y border-base-300 bg-base-200 py-2 px-3 text-left font-bold">User</th>
                  <th class="border-y border-base-300 bg-base-200 py-2 px-3 text-center font-bold">Status</th>
                  <th class="border-y border-base-300 bg-base-200 py-2 px-3 text-left font-bold">Data</th>
                  <th class="border-y border-base-300 bg-base-200 py-2 px-3 text-center font-bold">Created</th>
                  <th class="border-y border-base-300 bg-base-200 py-2 px-3 text-center font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each submissionData as submission}
                  <tr class="bg-base-100 hover:bg-base-300/30 {submission.hidden ? 'opacity-60' : ''}">
                    <td class="border-y border-base-300 py-2 px-3 font-mono text-sm">
                      {submission.id}
                      {#if submission.hidden}
                        <span class="badge badge-neutral badge-xs ml-1">Hidden</span>
                      {/if}
                    </td>
                    <td class="border-y border-base-300 py-2 px-3">
                      <div class="flex flex-col">
                        <span class="font-medium">
                          {challengeMap.get(submission.challenge_id) || `Challenge ${submission.challenge_id}`}
                        </span>
                        <span class="text-sm text-base-content/60 font-mono">ID: {submission.challenge_id}</span>
                      </div>
                    </td>
                    <td class="border-y border-base-300 py-2 px-3">
                      {#if submission.user_id}
                        {#await UserQueryService.get(submission.user_id)}
                          <span class="text-base-content/60">User {submission.user_id}</span>
                        {:then user}
                          <div class="flex flex-col">
                            <span class="font-medium">{user?.name || `User ${submission.user_id}`}</span>
                            <span class="text-sm text-base-content/60 font-mono">ID: {submission.user_id}</span>
                          </div>
                        {:catch}
                          <span class="text-base-content/60">User {submission.user_id}</span>
                        {/await}
                      {:else}
                        <span class="text-base-content/60 italic">System</span>
                      {/if}
                    </td>
                    <td class="border-y border-base-300 py-2 px-3 text-center">
                      <span class="badge {getSubmissionStatusBadgeClass(submission.status)} badge-sm">
                        {submission.status}
                      </span>
                    </td>
                    <td class="border-y border-base-300 py-2 px-3 max-w-xs">
                      <div class="truncate font-mono text-sm" title={submission.data}>
                        {submission.data}
                      </div>
                    </td>
                    <td class="border-y border-base-300 py-2 px-3 text-center text-sm text-base-content/70 font-mono">
                      {formatDateTime(submission.created_at)}
                    </td>
                    <td class="border-y border-base-300 py-2 px-3 text-center">
                      <button 
                        class="btn btn-error btn-xs pop hover:pop"
                        onclick={() => toggleSubmissionVisibility(submission.id, submission.hidden)}
                      >
                        {submission.hidden ? 'Unhide' : 'Hide'}
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          
          <div class="text-sm text-base-content/70 text-center">
            Showing {submissionData.length} submission{submissionData.length !== 1 ? 's' : ''}
          </div>
        {:else}
          <div class="flex flex-col items-center justify-center py-8 text-base-content/70">
            <Icon icon="material-symbols:assignment-outline" class="text-5xl mb-2" />
            <p class="text-lg font-medium">No submissions yet</p>
            <p class="text-sm">This team hasn't made any submissions</p>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>
