<script lang="ts">
  import { page } from "$app/state";
  import AdminHeader from "$lib/components/AdminHeader.svelte";
  import Header from "$lib/components/Header.svelte";
  import ThemeSwitcher, {
    hasFastThemeSwitcher,
  } from "$lib/components/ThemeSwitcher.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import { onMount } from "svelte";
  import "../app.css";
  import configState from "$lib/state/config.svelte";

  let { children } = $props();

  onMount(() => {
    const storedTheme = localStorage.getItem("theme");
    document.documentElement.setAttribute(
      "data-theme",
      storedTheme || "system",
    );
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

  {#if hasFastThemeSwitcher()}
    <div class="fixed left-6 bottom-4">
      <ThemeSwitcher />
    </div>
  {/if}
  <Toast />
  <footer class="text-center pb-4 text-xs">
    Powered by <a href="https://noctf.dev" class="text-primary">noCTF</a>
  </footer>
</div>
