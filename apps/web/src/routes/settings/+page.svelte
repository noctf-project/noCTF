<script lang="ts">
  import Icon from "@iconify/svelte";

  import ProfileTab from "./ProfileTab.svelte";
  import AccountTab from "./AccountTab.svelte";
  import SecurityTab from "./SecurityTab.svelte";
  import PreferencesTab from "./PreferencesTab.svelte";

  type TabType = "profile" | "account" | "security" | "preferences";

  let activeTab = $state<TabType>("profile");
</script>

{#snippet tab(id: TabType, title: string, icon: string)}
  <button
    tabindex="0"
    role="tab"
    class="rounded-lg text-left flex flex-row p-2 align-center {activeTab === id
      ? 'bg-primary text-primary-content'
      : ''} transition-all duration-200"
    onclick={() => (activeTab = id)}
  >
    <Icon {icon} class="text-2xl" />
    <div class="hidden sm:block ml-2">{title}</div>
  </button>
{/snippet}

<div class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-8">
  <h1 class="text-4xl font-bold mb-8">Settings</h1>

  <div class="flex flex-row gap-4">
    <div
      class="flex flex-col tabs-boxed bg-base-100 p-1 h-fit pop align w-14 sm:w-48"
    >
      {@render tab("profile", "Profile", "material-symbols:account-circle")}
      {@render tab("account", "Account", "material-symbols:person-book")}
      {@render tab("security", "Security", "material-symbols:lock")}
      {@render tab(
        "preferences",
        "Preferences",
        "material-symbols:palette-outline",
      )}
    </div>

    <div class="card bg-base-100 pop rounded-lg w-full">
      <div class="card-body">
        {#if activeTab === "profile"}
          <ProfileTab />
        {:else if activeTab === "account"}
          <AccountTab />
        {:else if activeTab === "security"}
          <SecurityTab />
        {:else if activeTab === "preferences"}
          <PreferencesTab />
        {/if}
      </div>
    </div>
  </div>
</div>
