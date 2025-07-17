<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import Icon from "@iconify/svelte";
  import { Carta, Markdown } from "carta-md";
  import DOMPurify from "isomorphic-dompurify";
  import notificationState from "$lib/state/notifications.svelte";
  import type { PathResponse } from "$lib/api/types";
  import { getRelativeTime } from "$lib/utils/time";

  type AnnouncementResponse = PathResponse<"/announcements", "get">;
  type Announcement = AnnouncementResponse["data"]["entries"][0];

  let isOpen = $state(false);
  let scrollContainer: HTMLDivElement | undefined = $state();

  const carta = new Carta({
    sanitizer: DOMPurify.sanitize,
  });

  function toggleNotifications() {
    isOpen = !isOpen;
    if (!isOpen) {
      notificationState.markAsRead();
    }
  }

  function closeNotifications() {
    isOpen = false;
    notificationState.markAsRead();
  }

  function handleScroll(event: Event) {
    const target = event.target as HTMLDivElement;
    const { scrollTop, scrollHeight, clientHeight } = target;

    if (scrollHeight - scrollTop - clientHeight < 100) {
      if (
        notificationState.hasMoreAnnouncements &&
        !notificationState.isLoadingMore
      ) {
        notificationState.loadOlderAnnouncements();
      }
    }
  }

  function hasBeenUpdated(announcement: Announcement) {
    const created = new Date(announcement.created_at);
    const updated = new Date(announcement.updated_at);
    return Math.abs(updated.getTime() - created.getTime()) >= 1000;
  }

  $effect(() => {
    if (notificationState.unseenCount > 0 && !isOpen) {
      isOpen = true;
    }
  });
</script>

<div class="fixed bottom-6 right-6 z-50">
  <button
    onclick={toggleNotifications}
    class="btn btn-primary pop hover:pop shadow-lg relative px-3 py-2 rounded-lg"
    aria-label="Notifications"
  >
    <Icon icon="material-symbols:notifications-outline" class="text-2xl" />
    {#if notificationState.unseenCount > 0}
      <div
        class="absolute -top-2 -right-2 min-w-6 h-6 bg-error text-error-content rounded-full flex items-center justify-center text-xs font-bold px-1 pop"
      >
        {notificationState.unseenCount > 99
          ? "99+"
          : notificationState.unseenCount}
      </div>
    {/if}
  </button>

  {#if isOpen}
    <div
      transition:fly={{ duration: 300, y: 20, easing: quintOut }}
      class="absolute bottom-16 right-0 w-96 sm:w-80 md:w-96 lg:w-[28rem] max-h-[40rem] sm:max-h-[36rem] md:max-h-[40rem] bg-base-100 pop rounded-lg shadow-xl overflow-hidden"
    >
      <div
        class="flex items-center justify-between p-4 border-b border-base-300"
      >
        <div class="flex items-center gap-2">
          <h3 class="font-semibold text-lg">Announcements</h3>
          {#if notificationState.unseenCount > 0}
            <div class="badge badge-primary badge-sm pop">
              {notificationState.unseenCount} new
            </div>
          {/if}
        </div>
        <button
          onclick={closeNotifications}
          class="btn btn-ghost btn-sm btn-circle"
          aria-label="Close notifications"
        >
          <Icon icon="material-symbols:close" class="text-lg" />
        </button>
      </div>

      <!-- Content -->
      <div
        class="max-h-96 sm:max-h-80 md:max-h-96 lg:max-h-[36rem] overflow-y-auto overflow-x-visible"
        bind:this={scrollContainer}
        onscroll={handleScroll}
        style="overflow-x: visible;"
      >
        {#if notificationState.isLoading && notificationState.announcements.length === 0}
          <div class="flex items-center justify-center p-8">
            <span class="loading loading-spinner loading-md"></span>
          </div>
        {:else if notificationState.announcements.length === 0}
          <div class="p-8 text-center text-base-content/60">
            <p>No announcements yet</p>
          </div>
        {:else}
          {#each notificationState.announcements as announcement (announcement)}
            {@const isUnseen = notificationState.lastSeenTimestamp
              ? new Date(announcement.updated_at) >
                new Date(notificationState.lastSeenTimestamp)
              : true}
            <div
              class="p-4 border-b border-base-300 last:border-b-0 hover:bg-base-200/50 relative"
            >
              {#if isUnseen}
                <div
                  class="absolute left-4 top-6 w-2 h-2 bg-primary rounded-full animate-pulse"
                ></div>
                <div
                  class="absolute left-0 top-0 bottom-0 w-1 bg-primary/30"
                ></div>
              {/if}
              <div class={isUnseen ? "ml-4" : ""}>
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 class="font-semibold text-base">{announcement.title}</h4>
                  {#if announcement.is_private}
                    <span class="badge badge-secondary badge-sm pop"
                      >Only visible to you</span
                    >
                  {/if}
                </div>
                <div
                  class="text-sm text-base-content/80 mb-2 prose prose-sm max-w-none notification-content"
                >
                  <Markdown {carta} value={announcement.message} />
                </div>
                <div
                  class="text-xs text-base-content/60 flex items-center gap-1"
                >
                  <span
                    class="tooltip tooltip-right cursor-help z-[200]"
                    data-tip={new Date(
                      announcement.created_at,
                    ).toLocaleString()}
                    style="position: relative;"
                  >
                    {getRelativeTime(new Date(announcement.created_at))}
                  </span>
                  {#if hasBeenUpdated(announcement)}
                    <span
                      class="text-base-content/40 text-xs tooltip tooltip-right"
                      data-tip={new Date(
                        announcement.updated_at,
                      ).toLocaleString()}>(edited)</span
                    >
                  {/if}
                </div>
              </div>
            </div>
          {/each}

          {#if notificationState.isLoadingMore}
            <div class="flex items-center justify-center p-4">
              <span class="loading loading-spinner loading-sm"></span>
              <span class="ml-2 text-sm text-base-content/60"
                >Loading older announcements...</span
              >
            </div>
          {/if}

          {#if !notificationState.hasMoreAnnouncements && notificationState.announcements.length > 0}
            <div class="p-4 text-center text-xs text-base-content/40">
              No more announcements
            </div>
          {/if}
        {/if}
      </div>
    </div>

    <!-- Only allow closing by clicking outside if it is not display unseen notifs -->
    {#if notificationState.unseenCount === 0}
      <div
        transition:fade={{ duration: 200 }}
        class="fixed inset-0 -z-10"
        onclick={closeNotifications}
        onkeydown={(e) => e.key === "Escape" && closeNotifications()}
        role="button"
        tabindex="-1"
        aria-label="Close notifications"
      ></div>
    {/if}
  {/if}
</div>

<style>
  :global(.notification-content .prose) {
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  :global(.notification-content .prose p) {
    margin: 0.25rem 0;
  }

  :global(.notification-content .prose ul, .notification-content .prose ol) {
    margin: 0.25rem 0;
    padding-left: 1rem;
  }

  :global(.notification-content .prose li) {
    margin: 0.125rem 0;
  }

  :global(.notification-content .prose code) {
    font-size: 0.75rem;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
  }

  :global(.notification-content .prose blockquote) {
    margin: 0.25rem 0;
    padding: 0.25rem 0.5rem;
    border-left: 2px solid;
  }
</style>
