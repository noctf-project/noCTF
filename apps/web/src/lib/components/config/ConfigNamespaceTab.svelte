<script lang="ts">
  /* eslint-disable @typescript-eslint/no-explicit-any */
  import { toasts } from "$lib/stores/toast";
  import api from "$lib/api/index.svelte";
  import Icon from "@iconify/svelte";
  import SchemaForm from "./SchemaForm.svelte";
  import JsonConfigEditor from "./JsonConfigEditor.svelte";
  import {
    initializeDataFromSchema,
    cleanDataForSubmission,
  } from "./schema-utils";

  type ConfigNamespace = {
    namespace: string;
    schema: any;
  };

  let {
    namespace,
    schema,
  }: {
    namespace: ConfigNamespace;
    schema: any;
  } = $props();

  let isEditing = $state(false);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let originalData = $state<Record<string, any>>({});
  let editData = $state<Record<string, any>>({});
  let version = $state<number>(0);
  let editorMode = $state<"visual" | "json">("visual");

  $effect(() => {
    loadConfigData();
  });

  async function loadConfigData() {
    const targetNamespace = namespace.namespace;
    try {
      isLoading = true;
      const response = await api.GET("/admin/config/{namespace}", {
        params: { path: { namespace: targetNamespace } },
      });

      if (namespace.namespace !== targetNamespace) {
        return;
      }

      if (response.data) {
        const configValue = response.data.data.value;
        originalData = initializeDataFromSchema(configValue, schema);
        editData = initializeDataFromSchema(configValue, schema);
        version = response.data.data.version;
      } else {
        toasts.error(
          `Failed to load config for ${targetNamespace}: ${response.error?.message}`,
        );
      }
    } catch (error) {
      if (namespace.namespace !== targetNamespace) return;
      console.error("Failed to load config data:", error);
      toasts.error(`Failed to load config for ${targetNamespace}`);
    } finally {
      if (namespace.namespace === targetNamespace) {
        isLoading = false;
      }
    }
  }

  function startEdit() {
    editData = initializeDataFromSchema(originalData, schema);
    isEditing = true;
  }

  function cancelEdit() {
    editData = { ...originalData };
    isEditing = false;
  }

  async function saveConfig() {
    try {
      isSaving = true;
      const cleanedData = cleanDataForSubmission(
        editData,
        schema?.properties,
        schema?.required,
      );
      const response = await api.PUT("/admin/config/{namespace}", {
        params: { path: { namespace: namespace.namespace } },
        body: {
          value: cleanedData,
          version: version,
        },
      });

      if (response.data) {
        originalData = { ...editData };
        version = (response.data as any).data.version;
        isEditing = false;
        toasts.success(
          `Configuration for ${namespace.namespace} saved successfully!`,
        );
      } else {
        throw new Error(
          (response.error as any)?.message || "Unknown error occurred",
        );
      }
    } catch (error) {
      console.error("Failed to save config:", error);
      toasts.error(`Failed to save config: ${error}`);
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="space-y-6">
  {#if isLoading}
    <div class="flex justify-center items-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else}
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-bold">{namespace.namespace}</h2>
        {#if schema.description}
          <p class="text-base-content/70 mt-1">{schema.description}</p>
        {/if}
      </div>

      <div class="flex items-center gap-2">
        {#if isEditing}
          <div class="join pop hover:pop">
            <button
              class="btn btn-sm join-item {editorMode === 'visual'
                ? 'btn-active'
                : 'btn-ghost'}"
              onclick={() => (editorMode = "visual")}
              disabled={isSaving}
            >
              <Icon icon="material-symbols:view-module" />
              Visual
            </button>
            <button
              class="btn btn-sm join-item {editorMode === 'json'
                ? 'btn-active'
                : 'btn-ghost'}"
              onclick={() => (editorMode = "json")}
              disabled={isSaving}
            >
              <Icon icon="material-symbols:code" />
              JSON
            </button>
          </div>

          <button
            class="btn btn-primary pop hover:pop"
            onclick={saveConfig}
            disabled={isSaving}
          >
            {#if isSaving}
              <span class="loading loading-spinner loading-sm"></span>
              Saving...
            {:else}
              <Icon icon="material-symbols:save" />
              Save
            {/if}
          </button>
          <button
            class="btn bg-base-100 pop hover:pop"
            onclick={cancelEdit}
            disabled={isSaving}
          >
            <Icon icon="material-symbols:close" />
            Cancel
          </button>
        {:else}
          <button class="btn btn-primary pop hover:pop" onclick={startEdit}>
            <Icon icon="material-symbols:edit" />
            Edit
          </button>
        {/if}
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300 pop">
      <div class="card-body {isEditing && editorMode === 'json' ? 'p-2' : ''}">
        {#if isEditing}
          {#if editorMode === "visual"}
            <SchemaForm {schema} bind:data={editData} disabled={false} />
          {:else}
            <JsonConfigEditor {schema} bind:data={editData} disabled={false} />
          {/if}
        {:else}
          <SchemaForm {schema} bind:data={originalData} disabled={true} />
        {/if}
      </div>
    </div>
  {/if}
</div>
