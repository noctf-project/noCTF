<script lang="ts">
  import { page } from "$app/state";
  import authState from "$lib/state/auth.svelte";
  import { IS_STATIC_EXPORT } from "$lib/static_export/middleware";
  import ViewAsSelector from "./ViewAsSelector.svelte";
  import Icon from "@iconify/svelte";

  const isActive = (path: string) => {
    return page.url.pathname === path
      ? "rounded-md bg-primary hover:bg-primary text-primary-content font-bold px-3 py-2"
      : "px-3 py-2";
  };

</script>

<div class="canvas_holder">
  <canvas id="bg_canvas" width="1200" height="800"></canvas>
</div>

<div class="navbar py-4 lg:py-8 px-4 sm:px-6 lg:px-12 min-h-24 lg:min-h-32 navbar_div">
  <!--
  <div class="navbar-start hidden">
    <ul
      class="menu menu-horizontal pop p-1 bg-base-100 rounded-lg flex gap-2 items-center"
    >
      <li>
        <a href="/challenges" class={isActive("/challenges")}>Challenges</a>
      </li>
      <li>
        <a href="/scoreboard" class={isActive("/scoreboard")}>Scoreboard</a>
      </li>
      <li>
        <a href="/teams" class={isActive("/teams")}>Teams</a>
      </li>
      {#if IS_STATIC_EXPORT}
        <li>
          <a href="/stats" class={isActive("/stats")}>Stats</a>
        </li>
      {/if}
      {#if authState.isAdmin}
        <li><a href="/admin" class={isActive("/admin")}>Admin Panel</a></li>
      {/if}
    </ul>
  </div>
-->

  <div class="navbar-start navbar_left">
    <div class="dropdown">
      <div
        tabindex="0"
        role="button"
        class="btn bg-base-100 pop hover:pop hover:none"
        aria-label="Open menu"
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
        class="menu menu-sm dropdown-content mt-3 z-[10] p-2 pop bg-base-100 rounded-box w-52"
        tabindex="-1"
      >
        <li>
          <a href="/challenges" class={isActive("/challenges")}>Challenges</a>
        </li>
        <li>
          <a href="/scoreboard" class={isActive("/scoreboard")}>Scoreboard</a>
        </li>
        <li>
          <a href="/teams" class={isActive("/teams")}>Teams</a>
        </li>
        {#if IS_STATIC_EXPORT}
          <li>
            <a href="/stats" class={isActive("/stats")}>Stats</a>
          </li>
        {/if}
        {#if authState.isAdmin}
          <li><a href="/admin" class={isActive("/admin")}>Admin Panel</a></li>
        {/if}
      </ul>
    </div>
<!--
    <a href="/" class="text-xl font-bold hidden lg:block"
      >{"noCTFs"}</a
    >
  -->
  </div>

  <div class="navbar-center justify-center navbar_logo_div">
    {#if !(page.url.pathname === "/")}
    <a href="/" class="text-xl">
      <img src="https://disorientation.cssa.club/files/logo-web-v3.png" alt="DisorientationCTF" class="navbar_logo">
      </a>
    {:else}
    <a href="https://cssa.club" class="navbar_cssa"> <!-- the cssa svg lol ik this is kinda stupid -->
      <svg width="254" height="94" viewBox="0 0 254 94" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M46.9826 7C36.377 7.00461 26.2073 11.2209 18.7096 18.7218C11.2119 26.2228 7 36.3943 7 47C7 57.6056 11.2119 67.7771 18.7096 75.278C26.2073 82.779 36.377 86.9953 46.9826 86.9999M53.6493 86.9999C64.2579 86.9999 74.4321 82.7857 81.9335 75.2843C89.435 67.7828 93.6492 57.6087 93.6493 47.0001C93.6492 41.7472 94.6839 36.5457 96.6941 31.6927C98.7042 26.8397 101.651 22.43 105.365 18.7157C109.079 15.0013 113.489 12.055 118.342 10.0448C123.195 8.03461 128.396 7 133.649 7M120.316 86.9999C130.925 86.9999 141.099 82.7857 148.6 75.2843C156.102 67.7828 160.316 57.6087 160.316 47.0001C160.316 41.7472 161.351 36.5457 163.361 31.6927C165.371 26.8397 168.317 22.43 172.032 18.7157C175.746 15.0013 180.155 12.055 185.009 10.0448C189.862 8.03461 195.063 7 200.316 7M206.983 7C212.235 7 217.437 8.03461 222.29 10.0448C227.143 12.055 231.552 15.0013 235.267 18.7157C238.981 22.43 241.928 26.8397 243.938 31.6927C245.948 36.5457 246.983 41.7472 246.983 47.0001M246.983 47.0001V93.6667M246.983 47.0001H206.983" stroke="black" stroke-width="13.3333"/>
</svg>
    </a>
    {/if}
  </div>


  <div class="navbar-end navbar_right">
    {#if IS_STATIC_EXPORT}
      <ViewAsSelector />
    {:else if !authState.isAuthenticated && !page.url.pathname.startsWith("/auth")}
      <a
        href="/auth"
        class="btn btn-primary text-primary-content px-6 sm:px-8 pop hover:pop"
        >Login</a
      >
    {:else if authState.isAuthenticated}
      <div class="dropdown dropdown-end">
        <div
          tabindex="0"
          role="button"
          class="btn hover:pop pop flex flex-row gap-0 px-2 bg-base-100 items-center"
          aria-label="User menu"
        >
          <Icon
            icon="material-symbols:account-circle"
            class="text-3xl lg:text-4xl text-neutral-600"
          />
          <div
            class="hidden sm:flex flex-col items-start pl-2 lg:min-w-32 max-w-32 gap-0"
          >
            <div
              class="text-left text-sm lg:text-base font-medium w-full truncate"
            >
              {authState.user?.name}
            </div>
            {#if authState.user?.team_name}
              <div
                class="text-left text-neutral-400 text-xs lg:text-sm hidden sm:block w-full truncate -mt-1"
              >
                {authState.user?.team_name}
              </div>
            {/if}
          </div>
          <Icon icon="mdi:chevron-down" class="hidden sm:block ml-1" />
        </div>
        <ul
          class="menu menu-sm dropdown-content mt-3 z-[10] p-1 px-2 pop bg-base-100 rounded-box w-52 gap-0"
          tabindex="-1"
        >
          <li class="flex flex-col sm:hidden pointer-events-none w-full gap-0">
            <div class="w-full font-semibold truncate">
              {authState.user?.name}
            </div>
            <div
              class="text-neutral-400 w-full font-semibold text-xs -mt-1 truncate"
            >
              {authState.user?.team_name}
            </div>
          </li>
          <div class="sm:hidden divider py-0 mt-1 mb-0"></div>
          <li class="py-1">
            <a href="/team" class={isActive("/team")}>Team</a>
          </li>
          <li class="py-1">
            <a href="/settings" class={isActive("/settings")}>Settings</a>
          </li>
          <li>
            <button
              onclick={authState.logout}
              class="text-error w-full text-left p-2">Logout</button
            >
          </li>
        </ul>
      </div>
    {/if}
  </div>

  <script>
  /* bg canvas */
  function drawbg() {
    console.log("painting bg...");
    const canvas = document.getElementById("bg_canvas");
    const qq = canvas.getContext("2d");
    qq.fillStyle = "rgb(0 0 255)";
    qq.strokeStyle = "#12091599";

    var x = 4;
    while (x < 1200) {
      qq.beginPath();
      qq.moveTo(x,0);
      qq.lineTo(x,400);
      qq.stroke();
      qq.closePath();
      x += 20;
    }

    var y = 4;
    while (y < 800) {
        qq.beginPath();
        qq.moveTo(0,y);
        qq.lineTo(600,y);
        qq.stroke();
        qq.closePath();
        y += 20;
    }

    

  }

  drawbg();
  </script>
</div>
