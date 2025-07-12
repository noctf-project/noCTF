<script lang="ts">
  import { toasts } from "$lib/stores/toast";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import Icon from "@iconify/svelte";

  type Policy = {
    id: number;
    name: string;
    description: string;
    match_roles: string[];
    omit_roles: string[];
    permissions: string[];
    public: boolean;
    is_enabled: boolean;
  };

  let policies = $state(wrapLoadable(fetchPolicies()));
  let isCreating = $state(false);
  let editingPolicy = $state<Policy | null>(null);
  let isUpdating = $state(false);
  let isDeleting = $state<number | null>(null);

  let createForm = $state({
    name: "",
    description: "",
    match_roles: "",
    omit_roles: "",
    permissions: "",
    public: false,
    is_enabled: true,
  });

  let editForm = $state({
    name: "",
    description: "",
    match_roles: "",
    omit_roles: "",
    permissions: "",
    public: false,
    is_enabled: true,
  });

  async function fetchPolicies() {
    const response = await api.GET("/admin/policies");
    if (!response.data) {
      toasts.error("Failed to fetch policies: " + response.error?.message);
      return undefined;
    }
    return response.data.data;
  }

  function parseArrayField(value: string): string[] {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  function formatArrayField(array: string[]): string {
    return array.join("\n");
  }

  async function createPolicy() {
    if (!createForm.name.trim()) {
      toasts.error("Please enter a policy name");
      return;
    }

    try {
      isCreating = true;
      const response = await api.POST("/admin/policies", {
        body: {
          name: createForm.name.trim(),
          description: createForm.description.trim(),
          match_roles: parseArrayField(createForm.match_roles),
          omit_roles: parseArrayField(createForm.omit_roles),
          permissions: parseArrayField(createForm.permissions),
          public: createForm.public,
          is_enabled: createForm.is_enabled,
        },
      });

      if (!response.data) {
        throw new Error(response.error?.message || "Unknown error occurred");
      }

      toasts.success("Policy created successfully!");
      createForm.name = "";
      createForm.description = "";
      createForm.match_roles = "";
      createForm.omit_roles = "";
      createForm.permissions = "";
      createForm.public = false;
      createForm.is_enabled = true;

      policies = wrapLoadable(fetchPolicies());
    } catch (error) {
      console.error("Failed to create policy:", error);
      toasts.error("Failed to create policy: " + error);
    } finally {
      isCreating = false;
    }
  }

  function startEdit(policy: Policy) {
    editingPolicy = policy;
    editForm.name = policy.name;
    editForm.description = policy.description;
    editForm.match_roles = formatArrayField(policy.match_roles);
    editForm.omit_roles = formatArrayField(policy.omit_roles);
    editForm.permissions = formatArrayField(policy.permissions);
    editForm.public = policy.public;
    editForm.is_enabled = policy.is_enabled;
  }

  function cancelEdit() {
    editingPolicy = null;
    editForm.name = "";
    editForm.description = "";
    editForm.match_roles = "";
    editForm.omit_roles = "";
    editForm.permissions = "";
    editForm.public = false;
    editForm.is_enabled = true;
  }

  async function updatePolicy(version: number) {
    if (!editingPolicy || !editForm.name.trim()) {
      toasts.error("Please enter a policy name");
      return;
    }

    try {
      isUpdating = true;
      const response = await api.PUT("/admin/policies/{id}", {
        params: { path: { id: editingPolicy.id } },
        body: {
          name: editForm.name.trim(),
          description: editForm.description.trim(),
          match_roles: parseArrayField(editForm.match_roles),
          omit_roles: parseArrayField(editForm.omit_roles),
          permissions: parseArrayField(editForm.permissions),
          public: editForm.public,
          is_enabled: editForm.is_enabled,
          version,
        },
      });

      if (response.error) {
        throw new Error(response.error?.message || "Unknown error occurred");
      }

      toasts.success("Policy updated successfully!");
      cancelEdit();

      policies = wrapLoadable(fetchPolicies());
    } catch (error) {
      console.error("Failed to update policy:", error);
      toasts.error("Failed to update policy: " + error);
    } finally {
      isUpdating = false;
    }
  }

  async function deletePolicy(id: number) {
    let confirmed = confirm("Are you sure you want to delete this policy?");
    if (!confirmed) return;

    if (
      policies.r &&
      policies.r.find(({ name }) => name === "admin")?.id === id
    ) {
      confirmed = confirm(
        "Are you really sure you want to delete the admin policy? You may seriously break things if you do this.",
      );
      if (!confirmed) return;
    }

    try {
      isDeleting = id;
      const response = await api.DELETE("/admin/policies/{id}", {
        params: { path: { id } },
      });

      if (response.error) {
        throw new Error(response.error?.message || "Unknown error occurred");
      }

      toasts.success("Policy deleted successfully!");

      policies = wrapLoadable(fetchPolicies());
    } catch (error) {
      console.error("Failed to delete policy:", error);
      toasts.error("Failed to delete policy: " + error);
    } finally {
      isDeleting = null;
    }
  }

  function getStatusBadgeClass(isEnabled: boolean) {
    return isEnabled ? "badge-success" : "badge-error";
  }

  function getPublicBadgeClass(isPublic: boolean) {
    return isPublic ? "badge-info" : "badge-neutral";
  }
</script>

<div class="container mx-auto p-6">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-4xl font-bold">Policies</h1>
  </div>

  <!-- Create Policy Form -->
  <div class="card bg-base-100 pop rounded-lg w-full mb-6">
    <div class="card-body">
      <h2 class="text-xl font-bold mb-4">Create New Policy</h2>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Name -->
        <div class="form-control">
          <label class="label" for="create-name">
            <span class="label-text">Name *</span>
          </label>
          <input
            type="text"
            placeholder="Policy name"
            class="input input-bordered"
            bind:value={createForm.name}
            maxlength="64"
            required
          />
        </div>

        <!-- Description -->
        <div class="form-control">
          <label class="label" for="create-description">
            <span class="label-text">Description</span>
          </label>
          <input
            type="text"
            placeholder="Policy description"
            class="input input-bordered"
            bind:value={createForm.description}
            maxlength="512"
          />
        </div>

        <!-- Match Roles -->
        <div class="form-control">
          <label class="label" for="create-match-roles">
            <span class="label-text">Match Roles</span>
          </label>
          <textarea
            placeholder="One role per line (e.g., admin, user, organiser)"
            class="textarea textarea-bordered h-24"
            bind:value={createForm.match_roles}
          ></textarea>
          <div class="label">
            <span class="label-text-alt">Roles that this policy applies to</span
            >
          </div>
        </div>

        <!-- Omit Roles -->
        <div class="form-control">
          <label class="label" for="create-omit-roles">
            <span class="label-text">Omit Roles</span>
          </label>
          <textarea
            placeholder="One role per line (e.g., blocked, frozen)"
            class="textarea textarea-bordered h-24"
            bind:value={createForm.omit_roles}
          ></textarea>
          <div class="label">
            <span class="label-text-alt">Roles that this policy excludes</span>
          </div>
        </div>

        <!-- Permissions -->
        <div class="form-control lg:col-span-2">
          <label class="label" for="create-permissions">
            <span class="label-text">Permissions</span>
          </label>
          <textarea
            placeholder="One permission per line (e.g., admin.*, challenge.get, team.get)"
            class="textarea textarea-bordered h-32"
            bind:value={createForm.permissions}
          ></textarea>
          <div class="label">
            <span class="label-text-alt">
              Permission strings. Use ! prefix for negative permissions (e.g.,
              !admin.*)
            </span>
          </div>
        </div>

        <!-- Checkboxes -->
        <div class="form-control">
          <label class="label cursor-pointer w-fit flex flex-row gap-4">
            <span class="label-text">Public Policy</span>
            <input
              type="checkbox"
              class="checkbox checkbox-primary"
              bind:checked={createForm.public}
            />
          </label>
          <div class="label">
            <span class="label-text-alt">Applies to unauthenticated users</span>
          </div>
        </div>

        <div class="form-control">
          <label class="label cursor-pointer w-fit flex flex-row gap-4">
            <span class="label-text">Enabled</span>
            <input
              type="checkbox"
              class="checkbox checkbox-primary"
              bind:checked={createForm.is_enabled}
            />
          </label>
          <div class="label">
            <span class="label-text-alt">Whether this policy is active</span>
          </div>
        </div>
      </div>

      <div class="card-actions justify-end mt-4">
        <button
          class="btn btn-primary pop hover:pop"
          onclick={createPolicy}
          disabled={isCreating}
        >
          {#if isCreating}
            <span class="loading loading-spinner loading-sm"></span>
          {:else}
            <Icon icon="material-symbols:add" class="text-xl" />
          {/if}
          Create Policy
        </button>
      </div>
    </div>
  </div>

  <!-- Policies List -->
  {#if policies.loading}
    <div class="flex justify-center items-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if policies.error}
    <div class="alert alert-error">
      <Icon icon="material-symbols:error" />
      <span>Failed to load policies</span>
    </div>
  {:else if policies.r}
    {@const data = policies.r}

    <div class="grid gap-4">
      {#each data as policy (policy.id)}
        <div class="card bg-base-100 pop rounded-lg">
          <div class="card-body">
            {#if editingPolicy?.id === policy.id}
              <!-- Edit Form -->
              <div class="space-y-4">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <!-- Name -->
                  <div class="form-control">
                    <label class="label" for="edit-name">
                      <span class="label-text">Name *</span>
                    </label>
                    <input
                      id="edit-name"
                      type="text"
                      class="input input-bordered"
                      bind:value={editForm.name}
                      maxlength="64"
                      required
                    />
                  </div>

                  <!-- Description -->
                  <div class="form-control">
                    <label class="label" for="edit-description">
                      <span class="label-text">Description</span>
                    </label>
                    <input
                      id="edit-description"
                      type="text"
                      class="input input-bordered"
                      bind:value={editForm.description}
                      maxlength="512"
                    />
                  </div>

                  <!-- Match Roles -->
                  <div class="form-control">
                    <label class="label" for="edit-match-roles">
                      <span class="label-text">Match Roles</span>
                    </label>
                    <textarea
                      id="edit-match-roles"
                      class="textarea textarea-bordered h-24"
                      bind:value={editForm.match_roles}
                    ></textarea>
                  </div>

                  <!-- Omit Roles -->
                  <div class="form-control">
                    <label class="label" for="edit-omit-roles">
                      <span class="label-text">Omit Roles</span>
                    </label>
                    <textarea
                      id="edit-omit-roles"
                      class="textarea textarea-bordered h-24"
                      bind:value={editForm.omit_roles}
                    ></textarea>
                  </div>

                  <!-- Permissions -->
                  <div class="form-control lg:col-span-2">
                    <label class="label" for="edit-permissions">
                      <span class="label-text">Permissions</span>
                    </label>
                    <textarea
                      id="edit-permissions"
                      class="textarea textarea-bordered h-32"
                      bind:value={editForm.permissions}
                    ></textarea>
                  </div>

                  <!-- Checkboxes -->
                  <div class="form-control">
                    <label class="label cursor-pointer">
                      <span class="label-text">Public Policy</span>
                      <input
                        type="checkbox"
                        class="checkbox"
                        bind:checked={editForm.public}
                      />
                    </label>
                  </div>

                  <div class="form-control">
                    <label class="label cursor-pointer">
                      <span class="label-text">Enabled</span>
                      <input
                        type="checkbox"
                        class="checkbox"
                        bind:checked={editForm.is_enabled}
                      />
                    </label>
                  </div>
                </div>

                <div class="card-actions justify-end">
                  <button
                    class="btn btn-ghost pop hover:pop"
                    onclick={cancelEdit}
                    disabled={isUpdating}
                  >
                    Cancel
                  </button>
                  <button
                    class="btn btn-primary pop hover:pop"
                    onclick={() => updatePolicy(policy.version)}
                    disabled={isUpdating}
                  >
                    {#if isUpdating}
                      <span class="loading loading-spinner loading-sm"></span>
                    {:else}
                      <Icon icon="material-symbols:save" class="text-xl" />
                    {/if}
                    Save Changes
                  </button>
                </div>
              </div>
            {:else}
              <!-- Display Mode -->
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-2">
                    <h3 class="text-xl font-semibold">{policy.name}</h3>
                    <span
                      class="badge {getStatusBadgeClass(
                        policy.is_enabled,
                      )} pop badge-sm"
                    >
                      {policy.is_enabled ? "Enabled" : "Disabled"}
                    </span>
                    {#if policy.public}
                      <span
                        class="badge {getPublicBadgeClass(
                          policy.public,
                        )} pop badge-sm"
                      >
                        Public
                      </span>
                    {/if}
                  </div>

                  {#if policy.description}
                    <p class="text-base-content/70 mb-3">
                      {policy.description}
                    </p>
                  {/if}

                  <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
                    <!-- Match Roles -->
                    <div>
                      <h4 class="font-medium text-base-content/80 mb-1">
                        Match Roles:
                      </h4>
                      {#if policy.match_roles.length > 0}
                        <div class="flex flex-wrap gap-1">
                          {#each policy.match_roles as role}
                            <span class="badge badge-outline pop badge-sm"
                              >{role}</span
                            >
                          {/each}
                        </div>
                      {:else}
                        <span class="text-base-content/50 italic"
                          >All roles</span
                        >
                      {/if}
                    </div>

                    <!-- Omit Roles -->
                    <div>
                      <h4 class="font-medium text-base-content/80 mb-1">
                        Omit Roles:
                      </h4>
                      {#if policy.omit_roles.length > 0}
                        <div class="flex flex-wrap gap-1">
                          {#each policy.omit_roles as role}
                            <span
                              class="badge badge-error badge-outline pop badge-sm"
                              >{role}</span
                            >
                          {/each}
                        </div>
                      {:else}
                        <span class="text-base-content/50 italic">None</span>
                      {/if}
                    </div>

                    <!-- Permissions -->
                    <div>
                      <h4 class="font-medium text-base-content/80 mb-1">
                        Permissions:
                      </h4>
                      {#if policy.permissions.length > 0}
                        <div class="flex flex-wrap gap-1">
                          {#each policy.permissions as permission}
                            <span
                              class="badge pop {permission.startsWith('!')
                                ? 'badge-error'
                                : 'badge-success'} badge-sm font-mono"
                            >
                              {permission}
                            </span>
                          {/each}
                        </div>
                      {:else}
                        <span class="text-base-content/50 italic">None</span>
                      {/if}
                    </div>
                  </div>
                </div>

                <div class="flex gap-2 ml-4">
                  <button
                    class="btn btn-sm btn-ghost pop hover:pop"
                    onclick={() => startEdit(policy)}
                  >
                    <Icon icon="material-symbols:edit" class="text-lg" />
                  </button>
                  <button
                    class="btn btn-sm btn-error pop hover:pop"
                    onclick={() => deletePolicy(policy.id)}
                    disabled={isDeleting === policy.id}
                  >
                    {#if isDeleting === policy.id}
                      <span class="loading loading-spinner loading-sm"></span>
                    {:else}
                      <Icon icon="material-symbols:delete" class="text-lg" />
                    {/if}
                  </button>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/each}

      {#if data.length === 0}
        <div class="text-center py-12">
          <Icon
            icon="material-symbols:policy"
            class="text-6xl text-base-content/30 mb-4"
          />
          <h3 class="text-xl font-semibold text-base-content/70 mb-2">
            No policies found
          </h3>
          <p class="text-base-content/50">
            Create your first policy to get started.
          </p>
        </div>
      {/if}
    </div>
  {/if}
</div>
