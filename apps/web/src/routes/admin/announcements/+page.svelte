<script lang="ts">
  import Icon from "@iconify/svelte";
  import { Carta, MarkdownEditor } from "carta-md";
  import DOMPurify from "isomorphic-dompurify";
  import "carta-md/default.css";

  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import { toasts } from "$lib/stores/toast";
  import userQueryService from "$lib/state/user_query.svelte";
  import teamQueryService from "$lib/state/team_query.svelte";
  import UserSearch from "$lib/components/UserSearch.svelte";
  import TeamSearch from "$lib/components/TeamSearch.svelte";

  type Announcement = {
    id: number;
    title: string;
    message: string;
    created_by: number | null;
    updated_by: number | null;
    visible_to: string[];
    delivery_channels: string[];
    created_at: string;
    updated_at: string;
    version: number;
  };

  type CreateAnnouncementForm = {
    title: string;
    message: string;
    visible_to: string[];
    delivery_channels: string[];
  };

  type AdminUser = {
    id: number;
    name: string;
    bio: string;
    created_at: string;
  };

  type AdminTeam = {
    id: number;
    name: string;
    bio: string;
    created_at: string;
  };

  let announcements = $state(wrapLoadable(fetchAnnouncements()));
  let deliveryChannels = $state(wrapLoadable(fetchDeliveryChannels()));

  let isCreating = $state(false);
  let editingAnnouncement = $state<Announcement | null>(null);
  let isUpdating = $state(false);
  let isDeleting = $state<number | null>(null);

  let createForm = $state<CreateAnnouncementForm>({
    title: "",
    message: "",
    visible_to: [],
    delivery_channels: [],
  });

  let editForm = $state<CreateAnnouncementForm>({
    title: "",
    message: "",
    visible_to: [],
    delivery_channels: [],
  });

  let isPublic = $state(false);
  let selectedUsers = $state<AdminUser[]>([]);
  let selectedTeams = $state<AdminTeam[]>([]);
  let showUserSearch = $state(false);
  let showTeamSearch = $state(false);

  let editIsPublic = $state(false);
  let editSelectedUsers = $state<AdminUser[]>([]);
  let editSelectedTeams = $state<AdminTeam[]>([]);
  let showEditUserSearch = $state(false);
  let showEditTeamSearch = $state(false);

  const carta = new Carta({
    sanitizer: DOMPurify.sanitize,
  });

  async function fetchAnnouncements() {
    const response = await api.POST("/admin/announcements/query", {
      body: { page: 1, page_size: 100 },
    });
    if (!response.data) {
      toasts.error("Failed to fetch announcements: " + response.error?.message);
      return { entries: [], total: 0 };
    }
    return response.data.data;
  }

  async function fetchDeliveryChannels() {
    const response = await api.GET("/admin/announcements/delivery_channels");
    if (!response.data) {
      toasts.error(
        "Failed to fetch delivery channels: " + response.error?.message,
      );
      return [];
    }
    return response.data.data;
  }

  function updateVisibilityArray() {
    const visibilityArray = [];
    if (isPublic) {
      visibilityArray.push("public");
    }
    selectedUsers.forEach((user) => visibilityArray.push(`user:${user.id}`));
    selectedTeams.forEach((team) => visibilityArray.push(`team:${team.id}`));
    createForm.visible_to = visibilityArray;
  }

  function updateEditVisibilityArray() {
    const visibilityArray = [];
    if (editIsPublic) {
      visibilityArray.push("public");
    }
    editSelectedUsers.forEach((user) =>
      visibilityArray.push(`user:${user.id}`),
    );
    editSelectedTeams.forEach((team) =>
      visibilityArray.push(`team:${team.id}`),
    );
    editForm.visible_to = visibilityArray;
  }

  async function parseVisibilityArray(visibleTo: string[]) {
    const users: AdminUser[] = [];
    const teams: AdminTeam[] = [];
    let publicFlag = false;

    const userIds: number[] = [];
    const teamIds: number[] = [];

    visibleTo.forEach((item) => {
      if (item === "public") {
        publicFlag = true;
      } else if (item.startsWith("user:")) {
        const userId = parseInt(item.substring(5));
        userIds.push(userId);
      } else if (item.startsWith("team:")) {
        const teamId = parseInt(item.substring(5));
        teamIds.push(teamId);
      }
    });

    if (userIds.length > 0) {
      try {
        const { data } = await api.POST("/admin/users/query", {
          body: { ids: userIds },
        });
        if (data?.data?.entries) {
          users.push(...data.data.entries);
        }
      } catch {
        userIds.forEach((userId) => {
          users.push({
            id: userId,
            name: `User ${userId}`,
            bio: "",
            created_at: "",
          });
        });
      }
    }

    if (teamIds.length > 0) {
      try {
        const { data } = await api.POST("/admin/teams/query", {
          body: { ids: teamIds },
        });
        if (data?.data?.entries) {
          teams.push(...data.data.entries);
        }
      } catch {
        teamIds.forEach((teamId) => {
          teams.push({
            id: teamId,
            name: `Team ${teamId}`,
            bio: "",
            created_at: "",
          });
        });
      }
    }

    return { users, teams, publicFlag };
  }

  function formatVisibility(visibleTo: string[]): {
    public: boolean;
    users: string[];
    teams: string[];
    other: string[];
  } {
    const result = {
      public: false,
      users: [] as string[],
      teams: [] as string[],
      other: [] as string[],
    };

    visibleTo.forEach((item) => {
      if (item === "public") {
        result.public = true;
      } else if (item.startsWith("user:")) {
        result.users.push(item.substring(5));
      } else if (item.startsWith("team:")) {
        result.teams.push(item.substring(5));
      } else {
        result.other.push(item);
      }
    });

    return result;
  }

  function handleVisibilityChange() {
    updateVisibilityArray();
  }

  function handleUserAdd(user: AdminUser) {
    if (!selectedUsers.find((u) => u.id === user.id)) {
      selectedUsers = [...selectedUsers, user];
      updateVisibilityArray();
    }
    showUserSearch = false;
  }

  function handleUserRemove(userId: number) {
    selectedUsers = selectedUsers.filter((u) => u.id !== userId);
    updateVisibilityArray();
  }

  function handleTeamAdd(team: AdminTeam) {
    if (!selectedTeams.find((t) => t.id === team.id)) {
      selectedTeams = [...selectedTeams, team];
      updateVisibilityArray();
    }
    showTeamSearch = false;
  }

  function handleTeamRemove(teamId: number) {
    selectedTeams = selectedTeams.filter((t) => t.id !== teamId);
    updateVisibilityArray();
  }

  function handleEditUserAdd(user: AdminUser) {
    if (!editSelectedUsers.find((u) => u.id === user.id)) {
      editSelectedUsers = [...editSelectedUsers, user];
      updateEditVisibilityArray();
    }
    showEditUserSearch = false;
  }

  function handleEditUserRemove(userId: number) {
    editSelectedUsers = editSelectedUsers.filter((u) => u.id !== userId);
    updateEditVisibilityArray();
  }

  function handleEditTeamAdd(team: AdminTeam) {
    if (!editSelectedTeams.find((t) => t.id === team.id)) {
      editSelectedTeams = [...editSelectedTeams, team];
      updateEditVisibilityArray();
    }
    showEditTeamSearch = false;
  }

  function handleEditTeamRemove(teamId: number) {
    editSelectedTeams = editSelectedTeams.filter((t) => t.id !== teamId);
    updateEditVisibilityArray();
  }

  async function createAnnouncement() {
    if (!createForm.title.trim()) {
      toasts.error("Please enter an announcement title");
      return;
    }
    if (!createForm.message.trim()) {
      toasts.error("Please enter an announcement message");
      return;
    }

    try {
      isCreating = true;
      const response = await api.POST("/admin/announcements", {
        body: {
          title: createForm.title.trim(),
          message: createForm.message.trim(),
          visible_to: createForm.visible_to,
          delivery_channels: createForm.delivery_channels,
        },
      });

      if (!response.data) {
        throw new Error(response.error?.message || "Unknown error occurred");
      }

      toasts.success("Announcement created successfully!");
      createForm.title = "";
      createForm.message = "";
      createForm.visible_to = [];
      createForm.delivery_channels = [];
      isPublic = false;
      selectedUsers = [];
      selectedTeams = [];

      announcements = wrapLoadable(fetchAnnouncements());
    } catch (error) {
      console.error("Failed to create announcement:", error);
      toasts.error("Failed to create announcement: " + error);
    } finally {
      isCreating = false;
    }
  }

  async function startEdit(announcement: Announcement) {
    editingAnnouncement = announcement;
    editForm.title = announcement.title;
    editForm.message = announcement.message;
    editForm.visible_to = [...announcement.visible_to];
    editForm.delivery_channels = [...announcement.delivery_channels];

    const { users, teams, publicFlag } = await parseVisibilityArray(
      announcement.visible_to,
    );
    editIsPublic = publicFlag;
    editSelectedUsers = users;
    editSelectedTeams = teams;
  }

  function cancelEdit() {
    editingAnnouncement = null;
    editForm.title = "";
    editForm.message = "";
    editForm.visible_to = [];
    editForm.delivery_channels = [];
    editIsPublic = false;
    editSelectedUsers = [];
    editSelectedTeams = [];
  }

  async function updateAnnouncement() {
    if (!editingAnnouncement || !editForm.title.trim()) {
      toasts.error("Please enter an announcement title");
      return;
    }
    if (!editForm.message.trim()) {
      toasts.error("Please enter an announcement message");
      return;
    }

    try {
      isUpdating = true;
      const response = await api.PUT("/admin/announcements/{id}", {
        params: { path: { id: editingAnnouncement.id } },
        body: {
          title: editForm.title.trim(),
          message: editForm.message.trim(),
          visible_to: editForm.visible_to,
          delivery_channels: editForm.delivery_channels,
          version: editingAnnouncement.version,
        },
      });

      if (response.error) {
        throw new Error(response.error?.message || "Unknown error occurred");
      }

      toasts.success("Announcement updated successfully!");
      cancelEdit();

      announcements = wrapLoadable(fetchAnnouncements());
    } catch (error) {
      console.error("Failed to update announcement:", error);
      toasts.error("Failed to update announcement: " + error);
    } finally {
      isUpdating = false;
    }
  }

  async function deleteAnnouncement(announcement: Announcement) {
    const confirmed = confirm(
      `Are you sure you want to delete the announcement "${announcement.title}"? This action cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      isDeleting = announcement.id;
      const response = await api.DELETE("/admin/announcements/{id}", {
        params: { path: { id: announcement.id } },
      });

      if (response.error) {
        throw new Error(response.error?.message || "Unknown error occurred");
      }

      toasts.success("Announcement deleted successfully!");

      announcements = wrapLoadable(fetchAnnouncements());
    } catch (error) {
      console.error("Failed to delete announcement:", error);
      toasts.error("Failed to delete announcement: " + error);
    } finally {
      isDeleting = null;
    }
  }

  function formatDateTime(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  function truncateMessage(message: string, maxLength: number = 200): string {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + "...";
  }

  async function renderMarkdown(markdown: string): Promise<string> {
    const rendered = await carta.render(markdown);
    return DOMPurify.sanitize(rendered);
  }

  $effect(() => {
    updateVisibilityArray();
  });

  $effect(() => {
    updateEditVisibilityArray();
  });
</script>

{#snippet visibilitySelector(isForEdit = false)}
  <div class="form-control">
    <div class="label">
      <span class="label-text">Visible To</span>
    </div>

    <!-- Public checkbox -->
    <div class="form-control">
      {#if isForEdit}
        <label
          class="cursor-pointer label justify-start"
          for="public-checkbox-edit"
        >
          <input
            id="public-checkbox-edit"
            type="checkbox"
            class="checkbox checkbox-primary mr-2"
            bind:checked={editIsPublic}
            onchange={() => updateEditVisibilityArray()}
          />
          <span class="label-text">Public (visible to everyone)</span>
        </label>
      {:else}
        <label
          class="cursor-pointer label justify-start"
          for="public-checkbox-create"
        >
          <input
            id="public-checkbox-create"
            type="checkbox"
            class="checkbox checkbox-primary mr-2"
            bind:checked={isPublic}
            onchange={() => handleVisibilityChange()}
          />
          <span class="label-text">Public (visible to everyone)</span>
        </label>
      {/if}
    </div>

    <!-- Selected users and teams display -->
    {#if (isForEdit ? editSelectedUsers : selectedUsers).length > 0 || (isForEdit ? editSelectedTeams : selectedTeams).length > 0}
      <div class="mt-2 space-y-2">
        {#if (isForEdit ? editSelectedUsers : selectedUsers).length > 0}
          <div>
            <span class="text-sm font-medium">Selected Users:</span>
            <div class="flex flex-wrap gap-1 mt-1">
              {#each isForEdit ? editSelectedUsers : selectedUsers as user}
                <div class="badge badge-primary gap-1 pop">
                  <Icon icon="material-symbols:person" class="text-xs" />
                  {user.name}
                  <button
                    type="button"
                    class="btn btn-xs btn-circle btn-ghost"
                    onclick={() =>
                      isForEdit
                        ? handleEditUserRemove(user.id)
                        : handleUserRemove(user.id)}
                  >
                    <Icon icon="material-symbols:close" class="text-xs" />
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if (isForEdit ? editSelectedTeams : selectedTeams).length > 0}
          <div>
            <span class="text-sm font-medium">Selected Teams:</span>
            <div class="flex flex-wrap gap-1 mt-1">
              {#each isForEdit ? editSelectedTeams : selectedTeams as team}
                <div class="badge badge-secondary gap-1 pop">
                  <Icon icon="material-symbols:group" class="text-xs" />
                  {team.name}
                  <button
                    type="button"
                    class="btn btn-xs btn-circle btn-ghost"
                    onclick={() =>
                      isForEdit
                        ? handleEditTeamRemove(team.id)
                        : handleTeamRemove(team.id)}
                  >
                    <Icon icon="material-symbols:close" class="text-xs" />
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Add users/teams buttons -->
    <div class="flex gap-2 mt-2">
      <button
        type="button"
        class="btn btn-sm bg-base-100 pop hover:pop"
        onclick={() =>
          isForEdit
            ? (showEditUserSearch = !showEditUserSearch)
            : (showUserSearch = !showUserSearch)}
      >
        <Icon icon="material-symbols:person-add" class="text-sm" />
        Add Users
      </button>
      <button
        type="button"
        class="btn btn-sm bg-base-100 pop hover:pop"
        onclick={() =>
          isForEdit
            ? (showEditTeamSearch = !showEditTeamSearch)
            : (showTeamSearch = !showTeamSearch)}
      >
        <Icon icon="material-symbols:group-add" class="text-sm" />
        Add Teams
      </button>
    </div>

    <!-- User search -->
    {#if isForEdit ? showEditUserSearch : showUserSearch}
      <div class="mt-2">
        <UserSearch
          onUserSelect={isForEdit ? handleEditUserAdd : handleUserAdd}
          placeholder="Type user name to search..."
          buttonText="Select User"
          excludedUserIds={isForEdit
            ? editSelectedUsers.map((u) => u.id)
            : selectedUsers.map((u) => u.id)}
        />
      </div>
    {/if}

    <!-- Team search -->
    {#if isForEdit ? showEditTeamSearch : showTeamSearch}
      <div class="mt-2">
        <TeamSearch
          onTeamSelect={isForEdit ? handleEditTeamAdd : handleTeamAdd}
          placeholder="Type team name to search..."
          buttonText="Select Team"
          excludedTeamIds={isForEdit
            ? editSelectedTeams.map((t) => t.id)
            : selectedTeams.map((t) => t.id)}
        />
      </div>
    {/if}
  </div>
{/snippet}

{#snippet announcementCard(announcement: Announcement)}
  {@const visibility = formatVisibility(announcement.visible_to)}
  <div class="card bg-base-200 border border-base-300">
    <div class="card-body">
      {#if editingAnnouncement?.id === announcement.id}
        <div class="space-y-4">
          <div class="form-control">
            <label class="label" for="edit-title-{announcement.id}">
              <span class="label-text">Title</span>
            </label>
            <input
              id="edit-title-{announcement.id}"
              type="text"
              bind:value={editForm.title}
              class="input input-bordered focus:outline-none focus:ring-0 focus:ring-offset-0"
              maxlength="128"
            />
          </div>

          <div class="form-control">
            <label class="label" for="edit-message-{announcement.id}">
              <span class="label-text">Message</span>
            </label>
            <div class="rounded-lg bg-base-100 border border-base-300">
              <MarkdownEditor
                {carta}
                bind:value={editForm.message}
                mode="tabs"
              />
            </div>
          </div>

          {#if deliveryChannels.r}
            <div class="form-control">
              <fieldset>
                <legend class="label">
                  <span class="label-text">Delivery Channels</span>
                </legend>
                <div class="flex flex-wrap gap-2">
                  {#each deliveryChannels.r as channel}
                    <label class="cursor-pointer label justify-start">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-primary mr-2"
                        bind:group={editForm.delivery_channels}
                        value={channel}
                      />
                      <span class="label-text">{channel}</span>
                    </label>
                  {/each}
                </div>
              </fieldset>
            </div>
          {/if}

          {@render visibilitySelector(true)}

          <div class="flex gap-2 justify-end">
            <button
              class="btn bg-base-100 pop hover:pop"
              onclick={cancelEdit}
              disabled={isUpdating}
            >
              <Icon icon="material-symbols:close" />
              Cancel
            </button>
            <button
              class="btn btn-primary pop hover:pop"
              onclick={updateAnnouncement}
              disabled={isUpdating ||
                !editForm.title.trim() ||
                !editForm.message.trim()}
            >
              {#if isUpdating}
                <span class="loading loading-spinner loading-sm"></span>
              {:else}
                <Icon icon="material-symbols:save" />
              {/if}
              Save Changes
            </button>
          </div>
        </div>
      {:else}
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h4 class="text-xl font-semibold mb-2">
              {announcement.title}
            </h4>

            <div class="prose prose-sm max-w-none mb-4">
              {#await renderMarkdown(truncateMessage(announcement.message))}
                <span class="loading loading-spinner loading-xs"></span>
              {:then rendered}
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html rendered}
              {:catch}
                <span class="text-base-content/70"
                  >{truncateMessage(announcement.message)}</span
                >
              {/await}
            </div>

            <div class="flex flex-wrap gap-2 mb-3">
              {#each announcement.delivery_channels as channel}
                <span class="badge badge-primary pop badge-sm">{channel}</span>
              {/each}
            </div>

            <!-- Visibility Information -->
            <div class="mb-3">
              <div class="flex items-center gap-2 mb-2">
                <Icon
                  icon="material-symbols:visibility"
                  class="text-sm text-base-content/70"
                />
                <span class="text-sm font-medium text-base-content/70"
                  >Visible to:</span
                >
              </div>
              <div class="flex flex-wrap gap-1">
                {#if visibility.public}
                  <span class="badge badge-success pop badge-sm">
                    <Icon icon="material-symbols:public" class="text-xs mr-1" />
                    Public
                  </span>
                {/if}
                {#each visibility.users as userId}
                  <span class="badge badge-primary pop badge-sm">
                    <Icon icon="material-symbols:person" class="text-xs mr-1" />
                    {#await userQueryService.get(parseInt(userId))}
                      User {userId}
                    {:then user}
                      {user?.name || `User ${userId}`}
                    {:catch}
                      User {userId}
                    {/await}
                  </span>
                {/each}
                {#each visibility.teams as teamId}
                  <span class="badge badge-secondary pop badge-sm">
                    <Icon icon="material-symbols:group" class="text-xs mr-1" />
                    {#await teamQueryService.get(parseInt(teamId))}
                      Team {teamId}
                    {:then team}
                      {team?.name || `Team ${teamId}`}
                    {:catch}
                      Team {teamId}
                    {/await}
                  </span>
                {/each}
                {#each visibility.other as item}
                  <span class="badge badge-neutral pop badge-sm">
                    <Icon icon="material-symbols:rule" class="text-xs mr-1" />
                    {item}
                  </span>
                {/each}
                {#if !visibility.public && visibility.users.length === 0 && visibility.teams.length === 0 && visibility.other.length === 0}
                  <span class="badge badge-warning pop badge-sm">
                    <Icon
                      icon="material-symbols:warning"
                      class="text-xs mr-1"
                    />
                    No visibility set
                  </span>
                {/if}
              </div>
            </div>

            <div class="text-sm text-base-content/70 space-y-1">
              <div class="flex items-center gap-2">
                <Icon icon="material-symbols:person" class="text-xs" />
                <span>
                  Created by {#if announcement.created_by}
                    {#await userQueryService.get(announcement.created_by)}
                      <span class="loading loading-spinner loading-xs"></span>
                    {:then user}
                      {user?.name || `User ${announcement.created_by}`}
                    {/await}
                  {:else}
                    System
                  {/if}
                  on {formatDateTime(announcement.created_at)}
                </span>
              </div>
              {#if announcement.updated_by && announcement.updated_at !== announcement.created_at}
                <div class="flex items-center gap-2">
                  <Icon icon="material-symbols:edit" class="text-xs" />
                  <span>
                    Updated by {#if announcement.updated_by}
                      {#await userQueryService.get(announcement.updated_by)}
                        <span class="loading loading-spinner loading-xs"></span>
                      {:then user}
                        {user?.name || `User ${announcement.updated_by}`}
                      {/await}
                    {:else}
                      System
                    {/if}
                    on {formatDateTime(announcement.updated_at)}
                  </span>
                </div>
              {/if}
            </div>
          </div>

          <div class="flex gap-2 ml-4">
            <button
              class="btn btn-sm bg-base-100 pop hover:pop"
              onclick={() => startEdit(announcement)}
            >
              <Icon icon="material-symbols:edit" class="text-lg" />
            </button>
            <button
              class="btn btn-sm btn-error pop hover:pop"
              onclick={() => deleteAnnouncement(announcement)}
              disabled={isDeleting === announcement.id}
            >
              {#if isDeleting === announcement.id}
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
{/snippet}

<div class="container mx-auto p-6">
  <div class="flex justify-between items-center mb-6">
    <div>
      <h1 class="text-4xl font-bold">Announcements</h1>
      <p class="text-base-content/70 mt-2">
        Manage system announcements and notifications
      </p>
    </div>
  </div>

  <div class="space-y-6">
    <div class="card bg-base-100 pop rounded-lg">
      <div class="card-body">
        <h3 class="text-lg font-semibold mb-4">Create New Announcement</h3>

        <div class="space-y-4">
          <div class="form-control">
            <label class="label" for="create-title">
              <span class="label-text">Title</span>
            </label>
            <input
              id="create-title"
              type="text"
              bind:value={createForm.title}
              placeholder="Enter announcement title"
              class="input input-bordered focus:outline-none focus:ring-0 focus:ring-offset-0"
              maxlength="128"
            />
          </div>

          <div class="form-control">
            <label class="label" for="create-message">
              <span class="label-text">Message</span>
            </label>
            <div class="rounded-lg bg-base-200 border border-base-300">
              <MarkdownEditor
                {carta}
                bind:value={createForm.message}
                mode="tabs"
              />
            </div>
          </div>

          {#if deliveryChannels.loading}
            <div class="flex justify-center items-center py-4">
              <span class="loading loading-spinner loading-sm"></span>
              <span class="ml-2">Loading delivery channels...</span>
            </div>
          {:else if deliveryChannels.error}
            <div class="alert alert-error pop">
              <Icon icon="material-symbols:error" />
              <span>Failed to load delivery channels</span>
            </div>
          {:else if deliveryChannels.r}
            <div class="form-control">
              <fieldset>
                <legend class="label">
                  <span class="label-text">Delivery Channels</span>
                </legend>
                <div class="flex flex-wrap gap-2">
                  {#each deliveryChannels.r as channel}
                    <label class="cursor-pointer label justify-start">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-primary mr-2"
                        bind:group={createForm.delivery_channels}
                        value={channel}
                      />
                      <span class="label-text">{channel}</span>
                    </label>
                  {/each}
                </div>
              </fieldset>
            </div>
          {/if}

          {@render visibilitySelector(false)}

          <button
            class="btn btn-primary pop hover:pop"
            onclick={createAnnouncement}
            disabled={isCreating ||
              !createForm.title.trim() ||
              !createForm.message.trim()}
          >
            {#if isCreating}
              <span class="loading loading-spinner loading-sm"></span>
              Creating...
            {:else}
              <Icon icon="material-symbols:add" class="text-lg" />
              Create Announcement
            {/if}
          </button>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 pop rounded-lg">
      <div class="card-body">
        <h3 class="text-lg font-semibold mb-4">Past Announcements</h3>

        {#if announcements.loading}
          <div class="flex justify-center items-center py-8">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        {:else if announcements.error}
          <div class="alert alert-error pop">
            <Icon icon="material-symbols:error" />
            <span>Failed to load announcements</span>
          </div>
        {:else if announcements.r?.entries && announcements.r.entries.length > 0}
          <div class="space-y-4">
            {#each announcements.r.entries as announcement}
              {@render announcementCard(announcement)}
            {/each}
          </div>
        {:else}
          <div
            class="flex flex-col items-center justify-center py-8 text-base-content/70"
          >
            <Icon
              icon="material-symbols:campaign-outline"
              class="text-5xl mb-2"
            />
            <p class="text-lg font-medium">No announcements yet</p>
            <p class="text-sm">Create your first announcement above</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
