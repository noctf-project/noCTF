import api from "$lib/api/index.svelte";

interface User {
  id: number;
  name: string;
  bio: string;
  roles: string[];
  team_id: number | null;
  team_name: string | null;
}

class AuthState {
  user?: User = $state();
  isInitialised: boolean = false;
  isAuthenticated: boolean = $derived(!!this.user?.id);
  isAdmin: boolean = $derived(!!this.user?.roles?.includes("admin"));

  async fetchState() {
    const r = await api.GET("/user/me");
    this.isInitialised = true;
    if (r.data) {
      this.user = r.data.data;
    }
  }

  async logout() {
    await api.POST("/auth/logout");
    window.location.href = "/";
  }
}

const authState = new AuthState();
export default authState;
