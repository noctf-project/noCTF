<script lang="ts">
  import Icon from "@iconify/svelte";
  import api from "$lib/api/index.svelte";
  import { createDebouncedState } from "$lib/utils/debounce.svelte";

  type AdminUser = {
    id: number;
    name: string;
    bio: string;
    created_at: string;
    identities?: Array<{
      provider: string;
      provider_id: string;
    }>;
  };

  interface Props {
    onUserSelect: (user: AdminUser) => void;
    placeholder?: string;
    showBio?: boolean;
    showCreatedAt?: boolean;
    buttonText?: string;
    excludedUserIds?: number[];
  }

  let {
    onUserSelect,
    placeholder = "Enter user name to search...",
    showBio = false,
    showCreatedAt = false,
    buttonText = "Select User",
    excludedUserIds = [],
  }: Props = $props();

  const userSearchQuery = createDebouncedState("", 300);
  let userSearchResults = $state<AdminUser[]>([]);
  let userSearchLoading = $state(false);
  let userSearchError = $state("");

  async function searchUsers() {
    if (!userSearchQuery.debouncedValue.trim()) {
      userSearchResults = [];
      return;
    }

    userSearchLoading = true;
    userSearchError = "";

    try {
      const { data, error } = await api.POST("/admin/users/query", {
        body: {
          page: 1,
          page_size: 20,
          name: userSearchQuery.debouncedValue,
        },
      });

      if (error) throw new Error(error.message);
      userSearchResults = data.data.entries;
    } catch (e) {
      userSearchError =
        e instanceof Error ? e.message : "Failed to search users";
      console.error(e);
      userSearchResults = [];
    } finally {
      userSearchLoading = false;
    }
  }

  $effect(() => {
    if (userSearchQuery.debouncedValue) {
      searchUsers();
    } else {
      userSearchResults = [];
    }
  });

  function handleUserSelect(user: AdminUser) {
    onUserSelect(user);
    userSearchQuery.value = "";
    userSearchResults = [];
  }

  function formatDateTime(dateString: string) {
    return new Date(dateString).toLocaleString();
  }
</script>

<div class="card bg-base-100 pop rounded-lg w-full">
  <div class="card-body">
    <div class="space-y-4">
      <!-- Search Input -->
      <div class="form-control w-full">
        <label for="user-search" class="label">
          <span class="label-text">Search for users by name</span>
        </label>
        <input
          id="user-search"
          type="text"
          bind:value={userSearchQuery.value}
          class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
          {placeholder}
        />
      </div>

      <!-- Search Results -->
      {#if userSearchLoading}
        <div class="flex justify-center items-center py-4">
          <span class="loading loading-spinner loading-md"></span>
          <span class="ml-2">Searching users...</span>
        </div>
      {:else if userSearchError}
        <div class="alert alert-error pop">
          <Icon icon="material-symbols:error" />
          <span>{userSearchError}</span>
        </div>
      {:else if userSearchQuery.debouncedValue && userSearchResults.length === 0}
        <div class="text-center py-4 text-base-content/70">
          <p>
            No users found matching "{userSearchQuery.debouncedValue}"
          </p>
        </div>
      {:else if userSearchResults.length > 0}
        <div class="space-y-2">
          <h3 class="font-semibold">Search Results:</h3>
          <div
            class="pop border border-base-500 bg-base-100 rounded-lg overflow-x-auto max-h-64 overflow-y-auto"
          >
            <table class="w-full border-collapse">
              <thead>
                <tr>
                  <th
                    class="border-y border-base-300 bg-base-200 py-2 px-3 text-left font-bold sticky top-0"
                    >User</th
                  >
                  <th
                    class="border-y border-base-300 bg-base-200 py-2 px-3 text-left font-bold sticky top-0"
                    >ID</th
                  >
                  {#if showCreatedAt}
                    <th
                      class="border-y border-base-300 bg-base-200 py-2 px-3 text-left font-bold sticky top-0"
                      >Created</th
                    >
                  {/if}
                  <th
                    class="border-y border-base-300 bg-base-200 py-2 px-3 text-right font-bold sticky top-0"
                    >Action</th
                  >
                </tr>
              </thead>
              <tbody>
                {#each userSearchResults as user}
                  {@const isAlreadySelected = excludedUserIds.includes(user.id)}
                  <tr
                    class="bg-base-100 hover:bg-base-300/30"
                    class:opacity-50={isAlreadySelected}
                  >
                    <td class="border-y border-base-300 py-2 px-3">
                      <div class="flex flex-col">
                        <span class="font-medium">{user.name}</span>
                        {#if showBio && user.bio}
                          <span class="text-sm text-base-content/60"
                            >{user.bio}</span
                          >
                        {/if}
                        {#if isAlreadySelected}
                          <span class="text-xs text-success font-medium"
                            >Already selected</span
                          >
                        {/if}
                      </div>
                    </td>
                    <td class="border-y border-base-300 py-2 px-3">
                      <span class="font-mono text-sm">{user.id}</span>
                    </td>
                    {#if showCreatedAt}
                      <td class="border-y border-base-300 py-2 px-3">
                        <span class="text-sm text-base-content/70 font-mono">
                          {formatDateTime(user.created_at)}
                        </span>
                      </td>
                    {/if}
                    <td class="border-y border-base-300 py-2 px-3 text-right">
                      {#if isAlreadySelected}
                        <button class="btn btn-success btn-sm" disabled>
                          <Icon icon="material-symbols:check" class="text-sm" />
                          Selected
                        </button>
                      {:else}
                        <button
                          class="btn btn-primary btn-sm pop hover:pop"
                          onclick={() => handleUserSelect(user)}
                        >
                          <Icon
                            icon="material-symbols:person-add"
                            class="text-sm"
                          />
                          {buttonText}
                        </button>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
