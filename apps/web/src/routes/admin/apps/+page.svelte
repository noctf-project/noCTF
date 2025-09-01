<script lang="ts">
  import { toasts } from "$lib/stores/toast";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import Icon from "@iconify/svelte";

  type App = {
    id: number;
    name: string;
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
    scopes: string[];
    enabled: boolean;
    created_at: string;
    updated_at: string;
  };

  type CreateAppData = {
    name: string;
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
    scopes: string[];
    enabled: boolean;
  };

  type UpdateAppData = {
    name: string;
    client_id: string;
    redirect_uris: string[];
    scopes: string[];
    enabled: boolean;
    client_secret?: string;
  };

  let apps = $state(wrapLoadable(fetchApps()));
  let isCreating = $state(false);
  let editingApp = $state<App | null>(null);
  let isUpdating = $state(false);
  let isDeleting = $state<number | null>(null);

  let createForm = $state({
    name: "",
    client_id: "",
    client_secret: "",
    redirect_uris: "",
    scopes: "",
    enabled: true,
  });

  let editForm = $state({
    name: "",
    client_id: "",
    client_secret: "",
    redirect_uris: "",
    scopes: "",
    enabled: true,
  });

  async function fetchApps(): Promise<App[] | undefined> {
    const response = await api.GET("/admin/apps");
    if (!response.data) {
      toasts.error("Failed to fetch apps: " + response.error?.message);
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

  async function createApp(): Promise<void> {
    if (!createForm.name.trim() || !createForm.client_id.trim()) {
      toasts.error("Please enter a name and client ID");
      return;
    }

    try {
      isCreating = true;
      const response = await api.POST("/admin/apps", {
        body: {
          name: createForm.name.trim(),
          client_id: createForm.client_id.trim(),
          client_secret: createForm.client_secret.trim(),
          redirect_uris: parseArrayField(createForm.redirect_uris),
          scopes: parseArrayField(createForm.scopes),
          enabled: createForm.enabled,
        } satisfies CreateAppData,
      });

      if (!response.data) {
        throw new Error(response.error?.message || "Unknown error occurred");
      }

      toasts.success("App created successfully!");
      createForm.name = "";
      createForm.client_id = "";
      createForm.client_secret = "";
      createForm.redirect_uris = "";
      createForm.scopes = "";
      createForm.enabled = true;

      apps = wrapLoadable(fetchApps());
    } catch (error) {
      console.error("Failed to create app:", error);
      toasts.error("Failed to create app: " + error);
    } finally {
      isCreating = false;
    }
  }

  function startEdit(app: App): void {
    editingApp = app;
    editForm.name = app.name;
    editForm.client_id = app.client_id;
    editForm.client_secret = "";
    editForm.redirect_uris = formatArrayField(app.redirect_uris);
    editForm.scopes = formatArrayField(app.scopes);
    editForm.enabled = app.enabled;
  }

  function cancelEdit(): void {
    editingApp = null;
    editForm.name = "";
    editForm.client_id = "";
    editForm.client_secret = "";
    editForm.redirect_uris = "";
    editForm.scopes = "";
    editForm.enabled = true;
  }

  async function updateApp(): Promise<void> {
    if (!editingApp || !editForm.name.trim() || !editForm.client_id.trim()) {
      toasts.error("Please enter a name and client ID");
      return;
    }

    try {
      isUpdating = true;
      const updateData: UpdateAppData = {
        name: editForm.name.trim(),
        client_id: editForm.client_id.trim(),
        redirect_uris: parseArrayField(editForm.redirect_uris),
        scopes: parseArrayField(editForm.scopes),
        enabled: editForm.enabled,
      };

      if (editForm.client_secret.trim()) {
        updateData.client_secret = editForm.client_secret.trim();
      }

      const response = await api.PUT("/admin/apps/{id}", {
        params: { path: { id: editingApp.id } },
        body: updateData,
      });

      if (response.error) {
        throw new Error(response.error?.message || "Unknown error occurred");
      }

      toasts.success("App updated successfully!");
      cancelEdit();

      apps = wrapLoadable(fetchApps());
    } catch (error) {
      console.error("Failed to update app:", error);
      toasts.error("Failed to update app: " + error);
    } finally {
      isUpdating = false;
    }
  }

  async function deleteApp(id: number): Promise<void> {
    const confirmed = confirm("Are you sure you want to delete this app?");
    if (!confirmed) return;

    try {
      isDeleting = id;
      const response = await api.DELETE("/admin/apps/{id}", {
        params: { path: { id } },
      });

      if (response.error) {
        throw new Error(response.error?.message || "Unknown error occurred");
      }

      toasts.success("App deleted successfully!");

      apps = wrapLoadable(fetchApps());
    } catch (error) {
      console.error("Failed to delete app:", error);
      toasts.error("Failed to delete app: " + error);
    } finally {
      isDeleting = null;
    }
  }

  function getStatusBadgeClass(enabled: boolean): string {
    return enabled ? "badge-success" : "badge-error";
  }
</script>

<div class="container mx-auto p-6">
  <div class="flex justify-between items-center mb-6">
    <div>
      <h1 class="text-4xl font-bold">Apps</h1>
    </div>
  </div>

  <!-- Create App Form -->
  <div class="card bg-base-100 pop rounded-lg w-full mb-6">
    <div class="card-body">
      <h2 class="text-xl font-bold mb-4">Create New App</h2>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Name -->
        <div class="form-control">
          <label class="label" for="create-name">
            <span class="label-text">Name *</span>
          </label>
          <input
            type="text"
            placeholder="App name"
            class="input input-bordered"
            bind:value={createForm.name}
            maxlength="64"
            required
          />
        </div>

        <!-- Client ID -->
        <div class="form-control">
          <label class="label" for="create-client-id">
            <span class="label-text">Client ID *</span>
          </label>
          <input
            type="text"
            placeholder="client_id_here"
            class="input input-bordered"
            bind:value={createForm.client_id}
            maxlength="128"
            required
          />
        </div>

        <!-- Client Secret -->
        <div class="form-control lg:col-span-2">
          <label class="label" for="create-client-secret">
            <span class="label-text">Client Secret *</span>
          </label>
          <input
            type="password"
            placeholder="client_secret_here"
            class="input input-bordered"
            bind:value={createForm.client_secret}
            maxlength="255"
            required
          />
        </div>

        <!-- Redirect URIs -->
        <div class="form-control">
          <label class="label" for="create-redirect-uris">
            <span class="label-text">Redirect URIs</span>
          </label>
          <textarea
            placeholder="One URI per line&#10;https://example.com/callback&#10;https://app.example.com/auth"
            class="textarea textarea-bordered h-24"
            bind:value={createForm.redirect_uris}
          ></textarea>
          <div class="label">
            <span class="label-text-alt">Valid redirect URIs for this app</span>
          </div>
        </div>

        <!-- Scopes -->
        <div class="form-control">
          <label class="label" for="create-scopes">
            <span class="label-text">Scopes</span>
          </label>
          <textarea
            placeholder="One scope per line&#10;openid&#10;profile&#10;email"
            class="textarea textarea-bordered h-24"
            bind:value={createForm.scopes}
          ></textarea>
          <div class="label">
            <span class="label-text-alt">OAuth scopes this app can request</span
            >
          </div>
        </div>

        <!-- Enabled -->
        <div class="form-control lg:col-span-2">
          <label class="label cursor-pointer w-fit flex flex-row gap-4">
            <span class="label-text">Enabled</span>
            <input
              type="checkbox"
              class="checkbox checkbox-primary"
              bind:checked={createForm.enabled}
            />
          </label>
          <div class="label">
            <span class="label-text-alt">Whether this app is active</span>
          </div>
        </div>
      </div>

      <div class="card-actions justify-end mt-4">
        <button
          class="btn btn-primary pop hover:pop"
          onclick={createApp}
          disabled={isCreating}
        >
          {#if isCreating}
            <span class="loading loading-spinner loading-sm"></span>
          {:else}
            <Icon icon="material-symbols:add" class="text-xl" />
          {/if}
          Create App
        </button>
      </div>
    </div>
  </div>

  <!-- Apps List -->
  {#if apps.loading}
    <div class="flex justify-center items-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if apps.error}
    <div class="alert alert-error">
      <Icon icon="material-symbols:error" />
      <span>Failed to load apps</span>
    </div>
  {:else if apps.r}
    {@const data = apps.r}

    <div class="grid gap-4">
      {#each data as app (app.id)}
        <div class="card bg-base-100 pop rounded-lg">
          <div class="card-body">
            {#if editingApp?.id === app.id}
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

                  <!-- Client ID -->
                  <div class="form-control">
                    <label class="label" for="edit-client-id">
                      <span class="label-text">Client ID *</span>
                    </label>
                    <input
                      id="edit-client-id"
                      type="text"
                      class="input input-bordered"
                      bind:value={editForm.client_id}
                      maxlength="128"
                      required
                    />
                  </div>

                  <!-- Client Secret -->
                  <div class="form-control lg:col-span-2">
                    <label class="label" for="edit-client-secret">
                      <span class="label-text">Client Secret</span>
                    </label>
                    <input
                      id="edit-client-secret"
                      type="password"
                      placeholder="Leave empty to keep current secret"
                      class="input input-bordered"
                      bind:value={editForm.client_secret}
                      maxlength="255"
                    />
                    <div class="label">
                      <span class="label-text-alt"
                        >Leave empty to keep current secret</span
                      >
                    </div>
                  </div>

                  <!-- Redirect URIs -->
                  <div class="form-control">
                    <label class="label" for="edit-redirect-uris">
                      <span class="label-text">Redirect URIs</span>
                    </label>
                    <textarea
                      id="edit-redirect-uris"
                      class="textarea textarea-bordered h-24"
                      bind:value={editForm.redirect_uris}
                    ></textarea>
                  </div>

                  <!-- Scopes -->
                  <div class="form-control">
                    <label class="label" for="edit-scopes">
                      <span class="label-text">Scopes</span>
                    </label>
                    <textarea
                      id="edit-scopes"
                      class="textarea textarea-bordered h-24"
                      bind:value={editForm.scopes}
                    ></textarea>
                  </div>

                  <!-- Enabled -->
                  <div class="form-control lg:col-span-2">
                    <label
                      class="label cursor-pointer w-fit flex flex-row gap-4"
                    >
                      <span class="label-text">Enabled</span>
                      <input
                        type="checkbox"
                        class="checkbox checkbox-primary"
                        bind:checked={editForm.enabled}
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
                    onclick={updateApp}
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
                    <h3 class="text-xl font-semibold">{app.name}</h3>
                    <span
                      class="badge {getStatusBadgeClass(
                        app.enabled,
                      )} pop badge-sm"
                    >
                      {app.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>

                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                    <!-- Client ID -->
                    <div>
                      <h4 class="font-medium text-base-content/80 mb-1">
                        Client ID:
                      </h4>
                      <code class="text-xs bg-base-200 px-2 py-1 rounded">
                        {app.client_id}
                      </code>
                    </div>

                    <!-- Redirect URIs -->
                    <div>
                      <h4 class="font-medium text-base-content/80 mb-1">
                        Redirect URIs:
                      </h4>
                      {#if app.redirect_uris.length > 0}
                        <div class="space-y-1">
                          {#each app.redirect_uris as uri}
                            <code
                              class="text-xs bg-base-200 px-2 py-1 rounded block"
                            >
                              {uri}
                            </code>
                          {/each}
                        </div>
                      {:else}
                        <span class="text-base-content/50 italic"
                          >None configured</span
                        >
                      {/if}
                    </div>

                    <!-- Scopes -->
                    <div>
                      <h4 class="font-medium text-base-content/80 mb-1">
                        Scopes:
                      </h4>
                      {#if app.scopes.length > 0}
                        <div class="flex flex-wrap gap-1">
                          {#each app.scopes as scope}
                            <span class="badge badge-outline pop badge-sm"
                              >{scope}</span
                            >
                          {/each}
                        </div>
                      {:else}
                        <span class="text-base-content/50 italic">None</span>
                      {/if}
                    </div>

                    <!-- Created -->
                    <div>
                      <h4 class="font-medium text-base-content/80 mb-1">
                        Created:
                      </h4>
                      <span class="text-base-content/70">
                        {new Date(app.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="flex gap-2 ml-4">
                  <button
                    class="btn btn-sm btn-ghost pop hover:pop"
                    onclick={() => startEdit(app)}
                  >
                    <Icon icon="material-symbols:edit" class="text-lg" />
                  </button>
                  <button
                    class="btn btn-sm btn-error pop hover:pop"
                    onclick={() => deleteApp(app.id)}
                    disabled={isDeleting === app.id}
                  >
                    {#if isDeleting === app.id}
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
          <h3 class="text-xl font-semibold text-base-content/70 mb-2">
            No apps found
          </h3>
        </div>
      {/if}
    </div>
  {/if}
</div>
