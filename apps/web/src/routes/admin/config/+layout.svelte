<script lang="ts">
  import Icon from "@iconify/svelte";
  import { onMount } from "svelte";

  type TabType = "" | "team-tags";

  let { children } = $props();

  let activeTab = $state<TabType>("");

  function getTabUrl(tab: TabType): string {
    return `/admin/config/${tab}`;
  }

  function updateActiveTab() {
    const path = window.location.pathname;
    const pathSegments = path.split("/").filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1]!;

    if (["team-tags"].includes(lastSegment)) {
      activeTab = lastSegment as TabType;
    } else {
      activeTab = "";
    }
  }

  onMount(() => {
    updateActiveTab();

    window.addEventListener("popstate", updateActiveTab);

    return () => {
      window.removeEventListener("popstate", updateActiveTab);
    };
  });
</script>

{#snippet tab(id: TabType, title: string, icon: string)}
  <a
    href={getTabUrl(id)}
    tabindex="0"
    role="tab"
    class="rounded-lg text-left flex flex-row p-2 align-center {activeTab === id
      ? 'bg-primary text-primary-content'
      : ''} transition-all duration-200"
    onclick={() => (activeTab = id)}
  >
    <Icon {icon} class="text-2xl" />
    <div class="hidden sm:block ml-2">{title}</div>
  </a>
{/snippet}

<div class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-8">
  <div class="flex items-center gap-4 mb-8">
    <h1 class="text-4xl font-bold">Configuration</h1>
  </div>

  <div class="flex flex-row gap-4">
    <div
      class="flex flex-col tabs-boxed bg-base-100 p-1 h-fit pop align w-14 sm:w-48"
    >
      {@render tab("team-tags", "Team Tags", "material-symbols:label")}
    </div>

    <div class="card bg-base-100 pop rounded-lg w-full">
      <div class="card-body">
        {@render children()}
      </div>
    </div>
  </div>
</div>
