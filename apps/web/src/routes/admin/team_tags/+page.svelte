<script lang="ts">
  import { toasts } from "$lib/stores/toast";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import Icon from "@iconify/svelte";

  type TeamTag = {
    id: number;
    name: string;
    is_joinable: boolean;
    created_at: string;
  };

  let teamTags = $state(wrapLoadable(fetchTeamTags()));
  let isCreating = $state(false);
  let editingTag = $state<TeamTag | null>(null);
  let isUpdating = $state(false);
  let isDeleting = $state<number | null>(null);

  let createForm = $state({
    name: "",
    is_joinable: true,
  });

  let editForm = $state({
    name: "",
    is_joinable: true,
  });

  async function fetchTeamTags() {
    const response = await api.GET("/admin/team_tags");
    if (!response.data) {
      toasts.error("Failed to fetch team tags: " + response.error?.message);
      return { tags: [] };
    }
    return response.data.data;
  }

  async function createTeamTag() {
    if (!createForm.name.trim()) {
      toasts.error("Please enter a tag name");
      return;
    }

    try {
      isCreating = true;
      const response = await api.POST("/admin/team_tags", {
        body: {
          name: createForm.name.trim(),
          is_joinable: createForm.is_joinable,
        },
      });

      if (!response.data) {
        throw new Error(response.error?.message || "Unknown error occurred");
      }

      toasts.success("Team tag created successfully!");
      createForm.name = "";
      createForm.is_joinable = true;

      // Refresh the list
      teamTags = wrapLoadable(fetchTeamTags());
    } catch (error) {
      console.error("Failed to create team tag:", error);
      toasts.error("Failed to create team tag: " + error);
    } finally {
      isCreating = false;
    }
  }

  function startEdit(tag: TeamTag) {
    editingTag = tag;
    editForm.name = tag.name;
    editForm.is_joinable = tag.is_joinable;
  }

  function cancelEdit() {
    editingTag = null;
    editForm.name = "";
    editForm.is_joinable = true;
  }

  async function updateTeamTag() {
    if (!editingTag || !editForm.name.trim()) {
      toasts.error("Please enter a tag name");
      return;
    }

    try {
      isUpdating = true;
      const response = await api.PUT("/admin/team_tags/{id}", {
        params: { path: { id: editingTag.id } },
        body: {
          name: editForm.name.trim(),
          is_joinable: editForm.is_joinable,
        },
      });

      if (response.error) {
        throw new Error(response.error?.message || "Unknown error occurred");
      }

      toasts.success("Team tag updated successfully!");
      cancelEdit();

      // Refresh the list
      teamTags = wrapLoadable(fetchTeamTags());
    } catch (error) {
      console.error("Failed to update team tag:", error);
      toasts.error("Failed to update team tag: " + error);
    } finally {
      isUpdating = false;
    }
  }

  async function deleteTeamTag(tag: TeamTag) {
    const confirmed = confirm(
      `Are you sure you want to delete the tag "${tag.name}"? This action cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      isDeleting = tag.id;
      const response = await api.DELETE("/admin/team_tags/{id}", {
        params: { path: { id: tag.id } },
      });

      if (response.error) {
        throw new Error(response.error?.message || "Unknown error occurred");
      }

      toasts.success("Team tag deleted successfully!");

      // Refresh the list
      teamTags = wrapLoadable(fetchTeamTags());
    } catch (error) {
      console.error("Failed to delete team tag:", error);
      toasts.error("Failed to delete team tag: " + error);
    } finally {
      isDeleting = null;
    }
  }

  function formatDateTime(dateString: string) {
    return new Date(dateString).toLocaleString();
  }
</script>

<div class="container mx-auto p-6">
  <div class="flex justify-between items-center mb-6">
    <div>
      <h1 class="text-4xl font-bold">Team Tags</h1>
      <p class="text-base-content/70 mt-2">
        Manage team tags that can be assigned to teams for scoreboard
        categorisation
      </p>
    </div>
  </div>

  <div class="space-y-6">
    <!-- Create New Tag -->
    <div class="card bg-base-100 pop rounded-lg">
      <div class="card-body">
        <h3 class="text-lg font-semibold mb-4">Create New Tag</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label" for="create-name">
              <span class="label-text">Tag Name</span>
            </label>
            <input
              id="create-name"
              type="text"
              bind:value={createForm.name}
              placeholder="Enter tag name"
              class="input input-bordered focus:outline-none focus:ring-0 focus:ring-offset-0"
              maxlength="64"
            />
          </div>

          <div class="form-control">
            <label class="label" for="tag-settings">
              <span class="label-text">Settings</span>
            </label>
            <label class="cursor-pointer label justify-start">
              <input
                type="checkbox"
                class="checkbox checkbox-sm checkbox-primary mr-2"
                bind:checked={createForm.is_joinable}
              />
              <span class="label-text">Teams can join this tag</span>
            </label>
          </div>
        </div>

        <div class="flex justify-end mt-4">
          <button
            class="btn btn-primary pop hover:pop"
            onclick={createTeamTag}
            disabled={isCreating || !createForm.name.trim()}
          >
            {#if isCreating}
              <span class="loading loading-spinner loading-sm"></span>
              Creating...
            {:else}
              <Icon icon="material-symbols:add" class="text-lg" />
              Create Tag
            {/if}
          </button>
        </div>
      </div>
    </div>

    <!-- Tags List -->
    <div class="card bg-base-100 pop rounded-lg">
      <div class="card-body">
        <h3 class="text-lg font-semibold mb-4">Existing Tags</h3>

        {#if teamTags.loading}
          <div class="flex justify-center items-center py-8">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        {:else if teamTags.error}
          <div class="alert alert-error pop">
            <Icon icon="material-symbols:error" />
            <span>Failed to load team tags</span>
          </div>
        {:else if teamTags.r?.tags && teamTags.r.tags.length > 0}
          <div class="overflow-x-auto">
            <table class="table w-full">
              <thead>
                <tr>
                  <th class="text-left">Name</th>
                  <th class="text-center">Joinable</th>
                  <th class="text-left">Created</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each teamTags.r.tags as tag}
                  <tr class="hover:bg-base-200/50">
                    <td>
                      {#if editingTag?.id === tag.id}
                        <input
                          type="text"
                          bind:value={editForm.name}
                          class="input input-bordered input-sm w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
                          maxlength="64"
                        />
                      {:else}
                        <span class="font-medium">{tag.name}</span>
                      {/if}
                    </td>
                    <td class="text-center">
                      {#if editingTag?.id === tag.id}
                        <input
                          type="checkbox"
                          class="checkbox checkbox-sm checkbox-primary"
                          bind:checked={editForm.is_joinable}
                        />
                      {:else}
                        <span
                          class="badge {tag.is_joinable
                            ? 'badge-success'
                            : 'badge-neutral'} pop"
                        >
                          {tag.is_joinable ? "Yes" : "No"}
                        </span>
                      {/if}
                    </td>
                    <td>
                      <span class="text-sm text-base-content/70">
                        {formatDateTime(tag.created_at)}
                      </span>
                    </td>
                    <td class="text-right">
                      <div class="flex gap-2 justify-end">
                        {#if editingTag?.id === tag.id}
                          <button
                            class="btn btn-primary btn-xs pop hover:pop"
                            onclick={updateTeamTag}
                            disabled={isUpdating || !editForm.name.trim()}
                          >
                            {#if isUpdating}
                              <span class="loading loading-spinner loading-xs"
                              ></span>
                            {:else}
                              <Icon icon="material-symbols:save" />
                            {/if}
                            Save
                          </button>
                          <button
                            class="btn btn-ghost btn-xs pop hover:pop"
                            onclick={cancelEdit}
                            disabled={isUpdating}
                          >
                            <Icon icon="material-symbols:close" />
                            Cancel
                          </button>
                        {:else}
                          <button
                            class="btn btn-ghost btn-xs pop hover:pop"
                            onclick={() => startEdit(tag)}
                          >
                            <Icon icon="material-symbols:edit" />
                            Edit
                          </button>
                          <button
                            class="btn btn-error btn-xs pop hover:pop"
                            onclick={() => deleteTeamTag(tag)}
                            disabled={isDeleting === tag.id}
                          >
                            {#if isDeleting === tag.id}
                              <span class="loading loading-spinner loading-xs"
                              ></span>
                            {:else}
                              <Icon icon="material-symbols:delete" />
                            {/if}
                            Delete
                          </button>
                        {/if}
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
            <Icon icon="material-symbols:label-outline" class="text-5xl mb-2" />
            <p class="text-lg font-medium">No team tags yet</p>
            <p class="text-sm">Create your first team tag above</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
