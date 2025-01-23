<script lang="ts">
  import { page } from "$app/state";
  import AdminHeader from "$lib/components/AdminHeader.svelte";
  import Header from "$lib/components/Header.svelte";
  import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";
  import "../app.css";

  let { children } = $props();
</script>

<div class="flex flex-col min-h-screen h-auto">
  {#if page.url.pathname.startsWith("/admin")}
    <AdminHeader />
  {:else}
    <Header />
  {/if}
  <div class="flex-1 w-full h-auto bg-base-200">
    {@render children()}
  </div>

  <div class="fixed left-6 bottom-1">
    <ThemeSwitcher />
  </div>
  <footer class="bg-base-200 text-center pb-4 text-xs">
    Powered by <a href="/TODO" class="text-primary">noCTF</a>
  </footer>
</div>
