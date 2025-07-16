import api from "$lib/api/index.svelte";
import type { PathResponse } from "$lib/api/types";
import { toasts } from "$lib/stores/toast";

type AnnouncementResponse = PathResponse<"/announcements", "get">;
type Announcement = AnnouncementResponse["data"]["entries"][0];

const LAST_SEEN_KEY = "noctf-last-seen-announcement";

class NotificationState {
  announcements = $state<Announcement[]>([]);
  isLoading = $state(false);
  hasUnread = $state(false);
  lastChecked = $state<string | null>(null);
  lastSeenTimestamp = $state<string | null>(null);
  unseenCount = $state(0);
  hasMoreAnnouncements = $state(true);
  isLoadingMore = $state(false);
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  private deduplicateAndSort(announcements: Announcement[]): Announcement[] {
    const uniqueMap = new Map<string, Announcement>();

    announcements.forEach((announcement) => {
      const key = announcement.created_at;
      if (
        !uniqueMap.has(key) ||
        new Date(announcement.updated_at) >
          new Date(uniqueMap.get(key)!.updated_at)
      ) {
        uniqueMap.set(key, announcement);
      }
    });

    return Array.from(uniqueMap.values()).sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }

  async fetchAnnouncements(updatedAt?: string) {
    try {
      this.isLoading = true;
      const params = updatedAt ? { updated_at: updatedAt } : {};
      const response = await api.GET("/announcements", {
        params: { query: params },
      });

      if (response.data) {
        const newAnnouncements = response.data.data.entries;

        if (updatedAt) {
          const combined = [...this.announcements, ...newAnnouncements];
          this.announcements = this.deduplicateAndSort(combined);

          if (newAnnouncements.length === 0) {
            this.hasMoreAnnouncements = false;
          } else if (
            response.data.data.page_size &&
            newAnnouncements.length < response.data.data.page_size
          ) {
            this.hasMoreAnnouncements = false;
          }
        } else {
          const existingIds = new Set(
            this.announcements.map((a) => a.created_at),
          );
          const newOnes = newAnnouncements.filter(
            (a) => !existingIds.has(a.created_at),
          );

          if (newOnes.length > 0 && this.announcements.length > 0) {
            this.hasUnread = true;
          }

          const combined = [...this.announcements, ...newAnnouncements];
          this.announcements = this.deduplicateAndSort(combined);
          this.hasMoreAnnouncements = newAnnouncements.length > 0;
        }

        if (this.announcements.length > 0) {
          this.lastChecked = this.announcements[0]?.updated_at || null;
        }

        this.updateUnseenCount();
      }
    } catch (error) {
      console.error("Failed to fetch announcements:", error);
      toasts.error("Failed to load announcements");
    } finally {
      this.isLoading = false;
    }
  }

  async loadOlderAnnouncements() {
    if (
      this.announcements.length === 0 ||
      !this.hasMoreAnnouncements ||
      this.isLoadingMore
    )
      return;

    const oldestAnnouncement =
      this.announcements[this.announcements.length - 1];
    if (oldestAnnouncement) {
      this.isLoadingMore = true;
      try {
        await this.fetchAnnouncements(oldestAnnouncement.updated_at);
      } finally {
        this.isLoadingMore = false;
      }
    }
  }

  private updateUnseenCount() {
    if (!this.lastSeenTimestamp) {
      this.unseenCount = this.announcements.length;
      return;
    }

    const lastSeenDate = new Date(this.lastSeenTimestamp);
    this.unseenCount = this.announcements.filter((announcement) => {
      const announcementDate = new Date(announcement.updated_at);
      return announcementDate > lastSeenDate;
    }).length;
  }

  private loadLastSeenTimestamp() {
    try {
      const stored = localStorage.getItem(LAST_SEEN_KEY);
      this.lastSeenTimestamp = stored;
    } catch (error) {
      console.error("Failed to load last seen timestamp:", error);
    }
  }

  private saveLastSeenTimestamp() {
    if (this.announcements.length > 0) {
      const latest = this.announcements[0];
      if (latest) {
        this.lastSeenTimestamp = latest.updated_at;
        try {
          localStorage.setItem(LAST_SEEN_KEY, this.lastSeenTimestamp);
        } catch (error) {
          console.error("Failed to save last seen timestamp:", error);
        }
      }
    }
  }

  startPolling() {
    this.pollInterval = setInterval(() => {
      this.fetchAnnouncements();
    }, 60000);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  markAsRead() {
    this.hasUnread = false;
    this.saveLastSeenTimestamp();
    this.unseenCount = 0;
  }

  constructor() {
    this.initialize();
  }

  async initialize() {
    this.loadLastSeenTimestamp();
    await this.fetchAnnouncements();
    this.startPolling();
  }

  destroy() {
    this.stopPolling();
  }
}

const notificationState = new NotificationState();
export default notificationState;
