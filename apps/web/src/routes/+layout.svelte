<script lang="ts">
  import { page } from "$app/state";
  import { Turnstile } from "svelte-turnstile";
  import AdminHeader from "$lib/components/AdminHeader.svelte";
  import Header from "$lib/components/Header.svelte";
  import ThemeSwitcher, {
    hasFastThemeSwitcher,
  } from "$lib/components/ThemeSwitcher.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import NotificationBell from "$lib/components/NotificationBell.svelte";
  import { onMount } from "svelte";
  import "../app.css";
  import configState from "$lib/state/config.svelte";
  import captchaState from "$lib/state/captcha.svelte";
  import notificationState from "$lib/state/notifications.svelte";

  let { children } = $props();

  const userFacingPages = [
    "/",
    "/challenges",
    "/scoreboard",
    "/teams",
    "/team",
    "/settings",
  ];

  const isUserFacingPage = $derived(
    !page.url.pathname.startsWith("/admin") &&
      !page.url.pathname.startsWith("/auth") &&
      userFacingPages.some(
        (path) =>
          page.url.pathname === path ||
          page.url.pathname.startsWith(path + "/"),
      ),
  );

  const shouldShowNotificationBell = $derived(
    isUserFacingPage &&
      (page.url.pathname.startsWith("/challenges") ||
        notificationState.unseenCount > 0),
  );

  onMount(() => {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const theme =
      localStorage.getItem("theme") || (prefersDark ? "dark" : "light");
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  });
</script>

<svelte:head>
  <title>{configState.siteConfig?.name || "noCTF"}</title>
</svelte:head>

<div class="flex flex-col min-h-screen h-auto">
  {#if page.url.pathname.startsWith("/admin")}
    <AdminHeader />
  {:else}
    <Header />
  {/if}

  <div class="flex-1 w-full h-auto">
    {@render children()}
  </div>
  {#if captchaState.show && captchaState.config?.public_key}
    <div
      id="captcha"
      class="fixed inset-0 bg-black bg-opacity-40 md:flex md:-mt-32 md:items-center p-4 z-100 justify-center item-center"
    >
      {#if captchaState.config?.provider === "cloudflare"}
        <Turnstile
          siteKey={captchaState.config.public_key}
          on:callback={(d) => captchaState.onSuccess(d.detail.token)}
          on:error={(e) => captchaState.onError(e)}
        />
      {/if}
    </div>
  {/if}

  {#if hasFastThemeSwitcher()}
    <div class="fixed left-6 bottom-4">
      <ThemeSwitcher />
    </div>
  {/if}

  {#if shouldShowNotificationBell}
    <NotificationBell />
  {/if}

  <Toast />
  <footer class="text-center pb-4 text-xs">
    Powered by <a href="https://noctf.dev" class="text-primary">noCTF</a>
  </footer>
</div>
