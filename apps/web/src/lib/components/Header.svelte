<script lang="ts">
  import { page } from "$app/state";

  import { isAuthenticated, isAdmin } from "$lib/state/auth.svelte";

  const isActive = (path: string) => {
    return page.url.pathname === path
      ? "bg-primary text-primary-content font-bold"
      : "";
  };
</script>

<div class="navbar bg-base-200 py-8 px-12 min-h-24">
  <div class="navbar-start">
    <!-- Mobile menu -->
    {#if isAuthenticated}
      <div class="dropdown">
        <div
          tabindex="0"
          role="button"
          class="btn btn-ghost hover:none lg:hidden"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h8m-8 6h16"
            />
          </svg>
        </div>
        <ul
          class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52"
        >
          <li>
            <a href="/challenges" class={isActive("/challenges")}>Challenges</a>
          </li>
          <li>
            <a href="/scoreboard" class={isActive("/scoreboard")}>Scoreboard</a>
          </li>
          <li><a href="/profile" class={isActive("/profile")}>Profile</a></li>
          {#if isAdmin}
            <li><a href="/admin" class={isActive("/admin")}>Admin Panel</a></li>
          {/if}
        </ul>
      </div>
    {/if}
    <a href="/" class="text-xl hidden lg:block">noCTF</a>
  </div>

  <div class="navbar-center lg:hidden">
    <a href="/" class="text-xl">noCTF</a>
  </div>

  <div class="navbar-center hidden lg:block">
    {#if isAuthenticated}
      <ul
        class="menu menu-horizontal border border-base-500 shadow-solid p-1 bg-base-100 rounded-lg flex gap-2"
      >
        <li>
          <a href="/challenges" class={isActive("/challenges")}>Challenges</a>
        </li>
        <li>
          <a href="/scoreboard" class={isActive("/scoreboard")}>Scoreboard</a>
        </li>
        <li><a href="/profile" class={isActive("/profile")}>Profile</a></li>
        {#if isAdmin}
          <li><a href="/admin" class={isActive("/admin")}>Admin Panel</a></li>
        {/if}
      </ul>
    {/if}
  </div>

  <div class="navbar-end">
    {#if !isAuthenticated && page.url.pathname !== "/auth"}
      <a href="/auth" class="btn btn-primary px-8">Login</a>
    {:else if isAuthenticated}
      <div>user</div>
    {/if}
  </div>
</div>
