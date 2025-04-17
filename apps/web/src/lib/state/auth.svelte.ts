import api, { SESSION_TOKEN_KEY } from "$lib/api/index.svelte";
import { toasts } from "$lib/stores/toast";

interface User {
  id: number;
  name: string;
  bio: string;
  roles: string[];
  team_id: number | null;
  team_name: string | null;
}

const USER_DATA_KEY = "noctf-user";
class AuthState {
  user?: User = $state();
  isLoading: boolean = $state(true);
  isAuthenticated: boolean = $derived(!!this.user?.id);
  isAdmin: boolean = $derived(!!this.user?.roles?.includes("admin"));

  constructor() {
    this.loadCachedUser();
    this.fetchState().then(() => {
      // this could be done cleaner, but there are only a few protected pages
      // so this should be fine for now
      const path = window.location.pathname;
      if (!this.isAuthenticated && path === "/team") {
        window.location.href = "/auth";
      } else if (this.isAuthenticated && path === "/auth") {
        window.location.href = "/";
      } else if (!this.isAdmin && path.startsWith("/admin")) {
        if (this.isAuthenticated) {
          window.location.href = "/";
        } else {
          window.location.href = "/auth";
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

  async fetchState() {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) {
      this.isLoading = false;
      return;
    }

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
    window.location.href = "/";
  }
}

const authState = new AuthState();
export default authState;
