<script lang="ts">
  import { page } from "$app/state";
  import { Turnstile } from "svelte-turnstile";
  import AdminHeader from "$lib/components/AdminHeader.svelte";
  import Header from "$lib/components/Header.svelte";
  import ThemeSwitcher, {
    hasFastThemeSwitcher,
  } from "$lib/components/ThemeSwitcher.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import { onMount } from "svelte";
  import "../app.css";
  import configState from "$lib/state/config.svelte";
  import captchaState from "$lib/state/captcha.svelte";

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
  <title>{configState.siteConfig?.name || "DownUnderCTF"}</title>
</svelte:head>

<div
  class={`bg-[url(/images/background.webp)] h-screen w-screen bg-center bg-cover opacity-70 -z-[999] fixed ${
    page.url.pathname === "/" ? "" : "blur-sm scale-[1.01] transition"
  }`}
></div>
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
  <Toast />
</div>
