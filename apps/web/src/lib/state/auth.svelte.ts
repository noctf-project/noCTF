import { goto } from "$app/navigation";
import api, { SESSION_TOKEN_KEY } from "$lib/api/index.svelte";
import { toasts } from "$lib/stores/toast";

interface User {
  id: number;
  name: string;
  bio: string;
  roles: string[];
  team_id: number | null;
  division_id: number | null;
  team_name: string | null;
}

const USER_DATA_KEY = "noctf-user";
class AuthState {
  user?: User = $state();
  isInitialised: boolean = $state(false);
  isLoading: boolean = $state(true);
  isAuthenticated: boolean = $derived(!!this.user?.id);
  isAdmin: boolean = $derived(!!this.user?.roles?.includes("admin"));
  isPartOfTeam: boolean = $derived(!!this.user?.team_id);

  constructor() {
    this.loadCachedUser();
    this.fetch().then(() => {
      // this could be done cleaner, but there are only a few protected pages
      // so this should be fine for now
      const path = window.location.pathname;
      if (
        !this.isAuthenticated &&
        (["/team", "/team/edit"].includes(path) || path.startsWith("/settings"))
      ) {
        goto(`/auth?redirect_to=${path}`);
      } else if (!this.isAuthenticated && path === "/auth/authorize") {
        goto(
          `/auth?redirect_to=${encodeURIComponent(location.href.slice(location.origin.length))}`,
        );
      } else if (this.isAuthenticated && path.startsWith("/auth")) {
        goto("/");
      } else if (!this.isAdmin && path.startsWith("/admin")) {
        if (this.isAuthenticated) {
          goto("/");
        } else {
          goto("/auth");
        }
      }
    });
  }

  private loadCachedUser() {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) {
      this.isLoading = false;
      return;
    }

    try {
      const cachedUserJSON = localStorage.getItem(USER_DATA_KEY);
      if (cachedUserJSON) {
        const cachedUser = JSON.parse(cachedUserJSON) as User;
        if (cachedUser?.id) {
          this.user = cachedUser;
        }
      }
    } catch (e) {
      console.error("Error loading cached user data", e);
      localStorage.removeItem(USER_DATA_KEY);
    }
  }

  async fetch() {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) {
      this.isLoading = false;
      return;
    }

    return this.refresh();
  }

  async refresh() {
    try {
      const r = await api.GET("/user/me");
      if (r.data) {
        this.user = r.data.data;
        localStorage.setItem(USER_DATA_KEY, JSON.stringify(r.data.data));
      } else {
        this.user = undefined;
        localStorage.removeItem(USER_DATA_KEY);
      }
    } catch (error) {
      toasts.error(`Unknown error: ${error}. Please try refreshing the page.`);
      console.error(`Unknown error: ${error}`);
    } finally {
      this.isLoading = false;
    }
  }

  async logout() {
    try {
      await api.POST("/auth/logout");
    } finally {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      localStorage.removeItem(USER_DATA_KEY);
      this.user = undefined;
    }
    await goto("/");
    window.location.reload();
  }
}

const authState = new AuthState();
export default authState;
