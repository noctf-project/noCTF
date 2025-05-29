<script lang="ts">
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import Icon from "@iconify/svelte";
  import { countryCodeToFlag, AllCountries } from "$lib/utils/country";
  import authState from "$lib/state/auth.svelte";

  let teamLoader = wrapLoadable(api.GET("/team"));
  let team = $derived(teamLoader.r?.data?.data);

  let teamDetailsLoader = $derived.by(() => {
    if (team) {
      return wrapLoadable(
        api.POST("/teams/query", { body: { ids: [team.id] } }),
      );
    }
  });
  let teamDetails = $derived(teamDetailsLoader?.r?.data?.data?.entries?.[0]);

  let isAuthorized = $derived.by(() => {
    if (!team || !teamDetails) return undefined;
    return (
      authState.user?.team_id === team.id &&
      teamDetails.members.some(
        (m) => m.user_id === authState.user?.id && m.role === "owner",
      )
    );
  });

  type TeamTag = {
    id: number;
    name: string;
    is_joinable: boolean;
  };

  const apiTeamTags = wrapLoadable(api.GET("/team_tags"));
  const teamTags: TeamTag[] = $derived(
    apiTeamTags.r?.data?.data?.tags.filter((t) => t.is_joinable) || [],
  );

  let name = $state("");
  let bio = $state("");
  let country = $state("");
  let refreshJoinCode = $state(false);
  let selectedTagIds = $state<number[]>([]);

  let loading = $state(false);
  let error = $state("");
  let success = $state("");

  $effect(() => {
    if (team) {
      name = team.name;
      bio = team.bio;
      country = team.country || "";
      selectedTagIds = team.tag_ids || [];
    }
  });

  function toggleTagSelection(tagId: number) {
    if (selectedTagIds.includes(tagId)) {
      selectedTagIds = selectedTagIds.filter((id) => id !== tagId);
    } else {
      selectedTagIds = [...selectedTagIds, tagId];
    }
  }

  async function handleSubmit() {
    loading = true;
    error = "";
    success = "";

    const updateData: {
      name: string;
      bio: string;
      country: string | null;
      tag_ids: number[];
      join_code?: "refresh";
    } = {
      name,
      bio,
      country: country || null,
      tag_ids: selectedTagIds,
    };

    if (refreshJoinCode) {
      updateData.join_code = "refresh";
    }

    try {
      const result = await api.PUT("/team", {
        body: updateData,
      });

      if (result.data?.data) {
        success = "Team updated successfully!";
        refreshJoinCode = false;
        const data = await api.GET("/team");
        teamLoader.r = data;
      } else {
        const message = result.error?.message
          ?.toString()
          ?.includes("must match pattern")
          ? "Name contains invalid characters"
          : result.error?.message;
        error = message || "Failed to update team";
      }
    } catch (e) {
      error = "An error occurred while updating the team";
      console.error(e);
    } finally {
      loading = false;
    }
  }
</script>

<div class="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
  {#if isAuthorized === false}
    <div class="flex flex-col items-center gap-4 mt-16">
      <div class="alert alert-error">
        <Icon icon="material-symbols:error-outline" class="text-2xl" />
        <span>You do not have permission to edit this team</span>
      </div>
      <a href="/team" class="btn btn-primary mt-4">Back to Team</a>
    </div>
  {:else if team === undefined}
    <div class="flex flex-col items-center gap-4 mt-16">
      <div class="loading loading-spinner loading-lg text-primary"></div>
      <p class="text-center">Loading...</p>
    </div>
  {:else if team}
    <div class="card bg-base-100 pop rounded-lg w-full">
      <div class="card-body">
        <div class="space-y-6">
          <div>
            <h1 class="text-2xl font-bold">Edit Team</h1>
          </div>

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

          <form onsubmit={handleSubmit} class="space-y-6">
            <div class="form-control w-full">
              <label for="name" class="label">
                <span class="label-text">Team Name</span>
              </label>
              <input
                id="name"
                type="text"
                bind:value={name}
                required
                minlength="1"
                maxlength="64"
                class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
                placeholder="Enter team name"
              />
            </div>

            <div class="form-control w-full">
              <label for="country" class="label">
                <span class="label-text">Country</span>
              </label>
              <select
                id="country"
                bind:value={country}
                class="select select-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
              >
                <option value="">No country selected</option>
                {#each Object.keys(AllCountries) as countryCode}
                  <option value={countryCode}>
                    {countryCodeToFlag(countryCode)}
                    {AllCountries[countryCode]}
                  </option>
                {/each}
              </select>
            </div>

            <div class="form-control w-full">
              <label for="bio" class="label">
                <span class="label-text">Team Bio</span>
              </label>
              <textarea
                id="bio"
                bind:value={bio}
                maxlength="256"
                class="textarea input-bordered h-32 w-full focus:outline-none focus:ring-0 focus:ring-offset-0 pt-2"
                placeholder="Describe your team..."
              ></textarea>
              <span class="label-text-alt text-right mt-1"
                >{bio.length}/256</span
              >
            </div>

            {#if !apiTeamTags.loading && teamTags.length > 0}
              <div class="form-control w-full !-mt-0.5">
                <label class="label" for="tags">
                  <span class="label-text">Team tags</span>
                </label>
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
                      {@const isSelected = selectedTagIds.includes(tag.id)}
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
                  {#if selectedTagIds.length > 0}
                    {selectedTagIds.length} tag{selectedTagIds.length !== 1
                      ? "s"
                      : ""} selected
                  {/if}
                </div>
              </div>
            {/if}

            <div
              class="form-control w-full {!apiTeamTags.loading &&
              teamTags.length === 0
                ? '!-mt-0.5'
                : ''}"
            >
              <div class="form-control w-full">
                <label class="label" for="refresh-join-code">
                  <span class="label-text">Join Code</span>
                </label>

                <div class="flex flex-col gap-4">
                  {#if team.join_code}
                    <div class="flex items-center gap-4">
                      <div class="bg-base-300 p-1.5 px-3 rounded-md font-mono">
                        {team.join_code}
                      </div>
                      <button
                        id="refresh-join-code"
                        type="button"
                        class="btn bg-base-100 btn-xs pop hover:pop"
                        onclick={() => (refreshJoinCode = true)}
                      >
                        <Icon icon="material-symbols:refresh" class="text-lg" />
                        Refresh Code
                      </button>
                    </div>
                  {:else}
                    <div class="text-error font-medium">
                      No join code available
                    </div>
                  {/if}

                  {#if refreshJoinCode}
                    <div class="alert alert-warning">
                      <Icon
                        icon="material-symbols:warning-outline"
                        class="text-xl"
                      />
                      <span>
                        Team join code will be refreshed upon saving changes.
                      </span>
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs"
                        onclick={() => (refreshJoinCode = false)}
                      >
                        Cancel
                      </button>
                    </div>
                  {/if}
                </div>
              </div>

              <div class="flex justify-end gap-3 mt-4">
                <a href="/team" class="btn btn-ghost">Cancel</a>
                <button
                  type="submit"
                  class="btn btn-primary pop hover:pop"
                  disabled={loading}
                >
                  {#if loading}
                    <div class="loading loading-spinner loading-xs"></div>
                    Saving...
                  {:else}
                    Save Changes
                  {/if}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  {/if}
</div>
