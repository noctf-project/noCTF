<script lang="ts">
  import { page } from "$app/state";

  const isActive = (path: string) => {
    return page.url.pathname === path
      ? "bg-primary text-primary-content font-bold"
      : "";
  };
</script>

<div class="navbar py-8 px-12">
  <div class="navbar-start">
    <!-- Mobile menu -->
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
          <a href="/admin/challenges" class={isActive("/admin/challenges")}
            >Challenges</a
          >
        </li>
        <li>
          <a href="/admin/users" class={isActive("/admin/users")}>Users</a>
        </li>
        <li>
          <a href="/admin/teams" class={isActive("/admin/teams")}>Teams</a>
        </li>
        <li>
          <a href="/admin/team_tags" class={isActive("/admin/team_tags")}
            >Team Tags</a
          >
        </li>
        <li>
          <a href="/admin/divisions" class={isActive("/admin/divisions")}
            >Divisions</a
          >
        </li>
        <li>
          <a href="/admin/submissions" class={isActive("/admin/submissions")}
            >Submissions</a
          >
        </li>
        <li>
          <a href="/admin/config" class={isActive("/admin/config")}>Config</a>
        </li>
      </ul>
    </div>
    <a href="/" class="text-xl hidden lg:block">noCTF</a>
  </div>

  <div class="navbar-center lg:hidden">
    <a href="/" class="text-xl">noCTF</a>
  </div>

  <div class="navbar-center hidden lg:block">
    <div class="flex flex-col gap-0 items-center">
      <div
        class="bg-error w-full border border-base-500 shadow-solid text-error-content px-3 py-1 text-center rounded-t text-xs font-semibold"
      >
        Admin
      </div>
      <ul
        class="menu menu-horizontal border border-base-500 shadow-solid p-1 bg-base-100 rounded-b flex gap-2"
      >
        <li>
          <a href="/admin/challenges" class={isActive("/admin/challenges")}
            >Challenges</a
          >
        </li>
        <li>
          <a href="/admin/users" class={isActive("/admin/users")}>Users</a>
        </li>
        <li>
          <a href="/admin/teams" class={isActive("/admin/teams")}>Teams</a>
        </li>
        <li>
          <a href="/admin/team_tags" class={isActive("/admin/team_tags")}
            >Team Tags</a
          >
        </li>
        <li>
          <a href="/admin/divisions" class={isActive("/admin/divisions")}
            >Divisions</a
          >
        </li>
        <li>
          <a href="/admin/submissions" class={isActive("/admin/submissions")}
            >Submissions</a
          >
        </li>
        <li>
          <a href="/admin/config" class={isActive("/admin/config")}>Config</a>
        </li>
      </ul>
    </div>
  </div>

  <div class="navbar-end"></div>
</div>
