<script lang="ts">
  import { toasts } from "$lib/stores/toast";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import Icon from "@iconify/svelte";

  type Division = {
    id: number;
    name: string;
    slug: string;
    description: string;
    is_visible: boolean;
    is_joinable: boolean;
    password?: string;
    created_at: string;
  };

  let divisions = $state(wrapLoadable(fetchDivisions()));
  let isCreating = $state(false);
  let editingDivision = $state<Division | null>(null);
  let isUpdating = $state(false);
  let isDeleting = $state<number | null>(null);
  let visiblePasswords = $state<Set<number>>(new Set());

  let createForm = $state({
    name: "",
    slug: "",
    description: "",
    is_visible: true,
    is_joinable: true,
    password: "",
  });

  let editForm = $state({
    name: "",
    slug: "",
    description: "",
    is_visible: true,
    is_joinable: true,
    password: "",
  });

  async function fetchDivisions() {
    const response = await api.GET("/admin/divisions");
    if (!response.data) {
      toasts.error("Failed to fetch divisions: " + response.error?.message);
      return { tags: [] };
    }
    return response.data.data;
  }

  async function createDivision() {
    if (!createForm.name.trim()) {
      toasts.error("Please enter a division name");
      return;
    }
    if (!createForm.slug.trim()) {
      toasts.error("Please enter a division slug");
      return;
    }

    try {
      isCreating = true;
      const response = await api.POST("/admin/divisions", {
        body: {
          name: createForm.name.trim(),
          slug: createForm.slug.trim(),
          description: createForm.description.trim(),
          is_visible: createForm.is_visible,
          is_joinable: createForm.is_joinable,
          password: createForm.password.trim() || undefined,
        },
      });

      if (!response.data) {
        throw new Error(response.error?.message || "Unknown error occurred");
      }

      toasts.success("Division created successfully!");
      createForm.name = "";
      createForm.slug = "";
      createForm.description = "";
      createForm.is_visible = true;
      createForm.is_joinable = true;
      createForm.password = "";

      divisions = wrapLoadable(fetchDivisions());
    } catch (error) {
      console.error("Failed to create division:", error);
      toasts.error("Failed to create division: " + error);
    } finally {
      isCreating = false;
    }
  }

  function startEdit(division: Division) {
    editingDivision = division;
    editForm.name = division.name;
    editForm.slug = division.slug;
    editForm.description = division.description;
    editForm.is_visible = division.is_visible;
    editForm.is_joinable = division.is_joinable;
    editForm.password = division.password || "";
  }

  function cancelEdit() {
    editingDivision = null;
    editForm.name = "";
    editForm.slug = "";
    editForm.description = "";
    editForm.is_visible = true;
    editForm.is_joinable = true;
    editForm.password = "";
  }

  async function updateDivision() {
    if (!editingDivision || !editForm.name.trim()) {
      toasts.error("Please enter a division name");
      return;
    }
    if (!editForm.slug.trim()) {
      toasts.error("Please enter a division slug");
      return;
    }

    try {
      isUpdating = true;
      const response = await api.PUT("/admin/divisions/{id}", {
        params: { path: { id: editingDivision.id } },
        body: {
          name: editForm.name.trim(),
          slug: editForm.slug.trim(),
          description: editForm.description.trim(),
          is_visible: editForm.is_visible,
          is_joinable: editForm.is_joinable,
          password: editForm.password.trim() || undefined,
        },
      });

      if (response.error) {
        throw new Error(response.error?.message || "Unknown error occurred");
      }

      toasts.success("Division updated successfully!");
      cancelEdit();

      divisions = wrapLoadable(fetchDivisions());
    } catch (error) {
      console.error("Failed to update division:", error);
      toasts.error("Failed to update division: " + error);
    } finally {
      isUpdating = false;
    }
  }

  async function deleteDivision(division: Division) {
    const confirmed = confirm(
      `Are you sure you want to delete the division "${division.name}"? This action cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      isDeleting = division.id;
      const response = await api.DELETE("/admin/divisions/{id}", {
        params: { path: { id: division.id } },
      });

      if (response.error) {
        throw new Error(response.error?.message || "Unknown error occurred");
      }

      toasts.success("Division deleted successfully!");

      divisions = wrapLoadable(fetchDivisions());
    } catch (error) {
      console.error("Failed to delete division:", error);
      toasts.error("Failed to delete division: " + error);
    } finally {
      isDeleting = null;
    }
  }

  function formatDateTime(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  function togglePasswordVisibility(divisionId: number) {
    if (visiblePasswords.has(divisionId)) {
      visiblePasswords.delete(divisionId);
    } else {
      visiblePasswords.add(divisionId);
    }
    visiblePasswords = new Set(visiblePasswords);
  }
</script>

<div class="container mx-auto p-6">
  <div class="flex justify-between items-center mb-6">
    <div>
      <h1 class="text-4xl font-bold">Divisions</h1>
      <p class="text-base-content/70 mt-2">
        Manage divisions that teams can join for competition categorisation
      </p>
    </div>
  </div>

  <div class="space-y-6">
    <!-- Create New Division -->
    <div class="card bg-base-100 pop rounded-lg">
      <div class="card-body">
        <h3 class="text-lg font-semibold mb-4">Create New Division</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label" for="create-name">
              <span class="label-text">Division Name</span>
            </label>
            <input
              id="create-name"
              type="text"
              bind:value={createForm.name}
              placeholder="Enter division name"
              class="input input-bordered focus:outline-none focus:ring-0 focus:ring-offset-0"
              maxlength="128"
            />
          </div>

          <div class="form-control">
            <label class="label" for="create-slug">
              <span class="label-text">Slug</span>
            </label>
            <input
              id="create-slug"
              type="text"
              bind:value={createForm.slug}
              placeholder="Enter division slug"
              class="input input-bordered focus:outline-none focus:ring-0 focus:ring-offset-0"
              maxlength="64"
            />
          </div>

          <div class="form-control md:col-span-2">
            <label class="label" for="create-description">
              <span class="label-text">Description</span>
            </label>
            <textarea
              id="create-description"
              bind:value={createForm.description}
              placeholder="Enter division description"
              class="textarea textarea-bordered focus:outline-none focus:ring-0 focus:ring-offset-0"
              maxlength="512"
              rows="3"
            ></textarea>
          </div>

          <div class="form-control">
            <label class="label" for="create-password">
              <span class="label-text">Password (Optional)</span>
            </label>
            <input
              id="create-password"
              type="password"
              bind:value={createForm.password}
              placeholder="Enter password (leave empty for none)"
              class="input input-bordered focus:outline-none focus:ring-0 focus:ring-offset-0"
              maxlength="64"
            />
          </div>

          <div class="form-control">
            <label class="label" for="division-settings">
              <span class="label-text">Settings</span>
            </label>
            <div class="space-y-2">
              <label class="cursor-pointer label justify-start">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm checkbox-primary mr-2"
                  bind:checked={createForm.is_visible}
                />
                <span class="label-text">Division is visible</span>
              </label>
              <label class="cursor-pointer label justify-start">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm checkbox-primary mr-2"
                  bind:checked={createForm.is_joinable}
                />
                <span class="label-text">Teams can join this division</span>
              </label>
            </div>
          </div>
        </div>

        <div class="flex justify-end mt-4">
          <button
            class="btn btn-primary pop hover:pop"
            onclick={createDivision}
            disabled={isCreating ||
              !createForm.name.trim() ||
              !createForm.slug.trim()}
          >
            {#if isCreating}
              <span class="loading loading-spinner loading-sm"></span>
              Creating...
            {:else}
              <Icon icon="material-symbols:add" class="text-lg" />
              Create Division
            {/if}
          </button>
        </div>
      </div>
    </div>

    <!-- Divisions List -->
    <div class="card bg-base-100 pop rounded-lg">
      <div class="card-body">
        <h3 class="text-lg font-semibold mb-4">Existing Divisions</h3>

        {#if divisions.loading}
          <div class="flex justify-center items-center py-8">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        {:else if divisions.error}
          <div class="alert alert-error pop">
            <Icon icon="material-symbols:error" />
            <span>Failed to load divisions</span>
          </div>
        {:else if divisions.r?.tags && divisions.r.tags.length > 0}
          <div class="overflow-x-auto">
            <table class="table w-full">
              <thead>
                <tr>
                  <th class="text-left">Name</th>
                  <th class="text-left">Slug</th>
                  <th class="text-left">Description</th>
                  <th class="text-center">Visible</th>
                  <th class="text-center">Joinable</th>
                  <th class="text-center">Password</th>
                  <th class="text-left">Created</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each divisions.r.tags as division}
                  <tr class="hover:bg-base-200/50">
                    <td>
                      {#if editingDivision?.id === division.id}
                        <input
                          type="text"
                          bind:value={editForm.name}
                          class="input input-bordered input-sm w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
                          maxlength="128"
                        />
                      {:else}
                        <span class="font-medium">{division.name}</span>
                      {/if}
                    </td>
                    <td>
                      {#if editingDivision?.id === division.id}
                        <input
                          type="text"
                          bind:value={editForm.slug}
                          class="input input-bordered input-sm w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
                          maxlength="64"
                        />
                      {:else}
                        <code class="text-sm bg-base-200 px-2 py-1 rounded"
                          >{division.slug}</code
                        >
                      {/if}
                    </td>
                    <td>
                      {#if editingDivision?.id === division.id}
                        <textarea
                          bind:value={editForm.description}
                          class="textarea textarea-bordered textarea-sm w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
                          maxlength="512"
                          rows="2"
                        ></textarea>
                      {:else}
                        <span class="text-sm text-base-content/70 line-clamp-2"
                          >{division.description}</span
                        >
                      {/if}
                    </td>
                    <td class="text-center">
                      {#if editingDivision?.id === division.id}
                        <input
                          type="checkbox"
                          class="checkbox checkbox-sm checkbox-primary"
                          bind:checked={editForm.is_visible}
                        />
                      {:else}
                        <span
                          class="badge {division.is_visible
                            ? 'badge-success'
                            : 'badge-neutral'} pop"
                        >
                          {division.is_visible ? "Yes" : "No"}
                        </span>
                      {/if}
                    </td>
                    <td class="text-center">
                      {#if editingDivision?.id === division.id}
                        <input
                          type="checkbox"
                          class="checkbox checkbox-sm checkbox-primary"
                          bind:checked={editForm.is_joinable}
                        />
                      {:else}
                        <span
                          class="badge {division.is_joinable
                            ? 'badge-success'
                            : 'badge-neutral'} pop"
                        >
                          {division.is_joinable ? "Yes" : "No"}
                        </span>
                      {/if}
                    </td>
                    <td class="text-center">
                      {#if editingDivision?.id === division.id}
                        <input
                          type="password"
                          bind:value={editForm.password}
                          placeholder="Password (optional)"
                          class="input input-bordered input-sm w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
                          maxlength="64"
                        />
                      {:else if division.password}
                        <div class="flex items-center justify-center gap-2">
                          <span class="font-mono text-sm">
                            {visiblePasswords.has(division.id)
                              ? division.password
                              : "••••••••"}
                          </span>
                          <button
                            class="btn btn-ghost btn-xs pop hover:pop"
                            onclick={() =>
                              togglePasswordVisibility(division.id)}
                            title={visiblePasswords.has(division.id)
                              ? "Hide password"
                              : "Show password"}
                          >
                            <Icon
                              icon={visiblePasswords.has(division.id)
                                ? "material-symbols:visibility-off"
                                : "material-symbols:visibility"}
                              class="text-sm"
                            />
                          </button>
                        </div>
                      {:else}
                        <span class="badge badge-neutral pop">None</span>
                      {/if}
                    </td>
                    <td>
                      <span class="text-sm text-base-content/70">
                        {formatDateTime(division.created_at)}
                      </span>
                    </td>
                    <td class="text-right">
                      <div class="flex gap-2 justify-end">
                        {#if editingDivision?.id === division.id}
                          <button
                            class="btn btn-primary btn-xs pop hover:pop"
                            onclick={updateDivision}
                            disabled={isUpdating ||
                              !editForm.name.trim() ||
                              !editForm.slug.trim()}
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
                            onclick={() => startEdit(division)}
                          >
                            <Icon icon="material-symbols:edit" />
                            Edit
                          </button>
                          <button
                            class="btn btn-error btn-xs pop hover:pop"
                            onclick={() => deleteDivision(division)}
                            disabled={isDeleting === division.id}
                          >
                            {#if isDeleting === division.id}
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
            <Icon
              icon="material-symbols:category-outline"
              class="text-5xl mb-2"
            />
            <p class="text-lg font-medium">No divisions yet</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
