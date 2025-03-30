<script lang="ts">
  import { page } from "$app/state";
  import authState from "$lib/state/auth.svelte";
  import Icon from "@iconify/svelte";
  import { onMount } from "svelte";

  const isActive = (path: string) => {
    return page.url.pathname === path
      ? "rounded-md bg-primary text-primary-content font-bold"
      : "";
  };

  onMount(async () => {
    if (!authState.isInitialised) {
      authState.fetchState();
    }
  });
</script>

<div class="navbar bg-base-200 py-8 px-12 min-h-32">
  <div class="navbar-start">
    {#if authState.isAuthenticated}
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
          {#if authState.isAdmin}
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
    {#if authState.isAuthenticated}
      <ul
        class="menu menu-horizontal pop p-1 bg-base-100 rounded-lg flex gap-2"
      >
        <li>
          <a href="/challenges" class={isActive("/challenges")}>Challenges</a>
        </li>
        <li>
          <a href="/scoreboard" class={isActive("/scoreboard")}>Scoreboard</a>
        </li>
        {#if authState.isAdmin}
          <li><a href="/admin" class={isActive("/admin")}>Admin Panel</a></li>
        {/if}
      </ul>
    {/if}
  </div>

  <div class="navbar-end">
    {#if !authState.isAuthenticated && page.url.pathname !== "/auth"}
      <a href="/auth" class="btn btn-primary px-8">Login</a>
    {:else if authState.isAuthenticated}
      <div class="dropdown dropdown-end">
        <div
          tabindex="0"
          role="button"
          class="btn hover:pop pop flex flex-row gap-0 px-2 bg-base-100"
        >
          <Icon
            icon="material-symbols:account-circle"
            class="text-4xl text-neutral-600"
          />
          <div class="flex flex-col items-start pl-2 lg:min-w-32 gap-0">
            <div class="text-left text-[1rem]">{authState.user?.name}</div>
            <div class="text-neutral-400">
              {authState.user?.team_name}
            </div>
          </div>
        </div>
        <ul
          class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52 gap-1"
        >
          <li><a href="/profile" class={isActive("/profile")}>Profile</a></li>
          <li>
            <button onclick={authState.logout} class="text-error">Logout</button
            >
          </li>
        </ul>
      </div>
    {/if}
  </div>
</div>
