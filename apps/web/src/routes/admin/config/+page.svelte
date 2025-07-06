<script lang="ts">
  import { toasts } from "$lib/stores/toast";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import Icon from "@iconify/svelte";
  import ConfigNamespaceTab from "$lib/components/config/ConfigNamespaceTab.svelte";
  import { onMount } from "svelte";

  let configSchemas = $state(wrapLoadable(fetchConfigSchemas()));
  let activeTab = $state<string>("");

  async function fetchConfigSchemas() {
    const response = await api.GET("/admin/config");
    if (!response.data) {
      toasts.error(
        "Failed to fetch config schemas: " + response.error?.message,
      );
      return [];
    }
    return response.data.data;
  }

  function updateActiveTab() {
    const hash = window.location.hash.slice(1); // Remove the #
    if (hash && configSchemas.r?.find((ns) => ns.namespace === hash)) {
      activeTab = hash;
    } else if (configSchemas.r && configSchemas.r.length > 0) {
      activeTab = configSchemas.r[0]?.namespace || "";
    }
  }

  function setActiveTab(namespace: string) {
    activeTab = namespace;
    window.location.hash = namespace;
  }

  onMount(() => {
    updateActiveTab();

    window.addEventListener("hashchange", updateActiveTab);

    return () => {
      window.removeEventListener("hashchange", updateActiveTab);
    };
  });

  $effect(() => {
    if (configSchemas.r && configSchemas.r.length > 0 && !activeTab) {
      updateActiveTab();
    }
  });

  const activeNamespace = $derived(
    configSchemas.r?.find((ns) => ns.namespace === activeTab),
  );
</script>

<div class="container mx-auto p-6">
  <div class="flex justify-between items-center mb-6">
    <div>
      <h1 class="text-4xl font-bold">Configuration</h1>
      <p class="text-base-content/70 mt-2">Manage CTF configuration settings</p>
    </div>
  </div>

  {#if configSchemas.loading}
    <div class="flex justify-center items-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if configSchemas.error}
    <div class="alert alert-error">
      <Icon icon="material-symbols:error" />
      <span>Failed to load configuration schemas</span>
    </div>
  {:else if configSchemas.r && configSchemas.r.length > 0}
    <div class="flex flex-col lg:flex-row gap-6">
      <div class="lg:w-64 flex-shrink-0">
        <div class="card bg-base-100 shadow-sm border border-base-300 pop">
          <div class="card-body p-4">
            <h3 class="font-semibold mb-3">Configuration Namespaces</h3>
            <div class="space-y-1">
              {#each configSchemas.r as namespace}
                <button
                  class="btn btn-ghost btn-sm w-full justify-start {activeTab ===
                  namespace.namespace
                    ? 'btn-active'
                    : ''}"
                  onclick={() => setActiveTab(namespace.namespace)}
                >
                  <Icon icon="material-symbols:settings" class="text-lg" />
                  <span>{namespace.namespace}</span>
                </button>
              {/each}
            </div>
          </div>
        </div>
      </div>

      <div class="flex-1">
        {#if activeNamespace}
          <ConfigNamespaceTab
            namespace={activeNamespace}
            schema={activeNamespace.schema}
          />
        {:else}
          <div class="card bg-base-100 shadow-sm border border-base-300 pop">
            <div class="card-body text-center py-12">
              <Icon
                icon="material-symbols:settings"
                class="text-6xl text-base-content/30 mx-auto mb-4"
              />
              <h3 class="text-xl font-semibold mb-2">
                Select a Configuration Namespace
              </h3>
              <p class="text-base-content/70">
                Choose a namespace from the sidebar to view and edit its
                settings.
              </p>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="card bg-base-100 shadow-sm border border-base-300 pop">
      <div class="card-body text-center py-12">
        <Icon
          icon="material-symbols:settings-outline"
          class="text-6xl text-base-content/30 mx-auto mb-4"
        />
        <h3 class="text-xl font-semibold mb-2">No Configuration Namespaces</h3>
        <p class="text-base-content/70">
          No configuration namespaces are available.
        </p>
      </div>
    </div>
  {/if}
</div>
