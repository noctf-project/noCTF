<script module>
  export { header, emailLocked };
</script>

<script lang="ts">
  import Icon from "@iconify/svelte";

  import loginState from "./auth.svelte";
  import authState from "$lib/state/auth.svelte";
  import { goto } from "$app/navigation";

  let { children } = $props();
  $effect(() => {
    // Only attempt redirect *after* the initial state fetch has completed
    if (authState.isInitialised && authState.isAuthenticated) {
      goto("/", { replaceState: true });
    }
  });
</script>

{#snippet header(heading: string, subHeading: string)}
  <div class="text-center mb-6">
    <h2 class="text-2xl font-bold">{heading}</h2>
    <p class="text-gray-600">{subHeading}</p>
  </div>
{/snippet}

{#snippet emailLocked()}
  <div class="form-control">
    <label for="email-locked" class="label">
      <span class="label-text">Email</span>
    </label>
    <div class="relative">
      <input
        id="email-locked"
        type="email"
        class="input input-bordered w-full pr-10 bg-base-200"
        value={loginState.email}
        disabled
      />
      <button
        type="button"
        class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
        onclick={loginState.goBack}
        title="Change email"
      >
        <Icon icon="material-symbols:edit" class="w-5 h-5" />
      </button>
    </div>
  </div>
{/snippet}

<div class="h-full flex flex-col gap-8 items-center justify-center p-4">
  <div
    class="card w-full max-w-md bg-base-100 shadow-solid border border-base-500"
  >
    <div class="card-body">
      {@render children()}
    </div>
  </div>

  <div class="text-sm text-gray-500 text-center max-w-md">
    By continuing, you agree to our <a href="/terms" class="link"
      >Terms of Service</a
    >
    and <a href="/privacy" class="link">Privacy Policy</a>.
  </div>
</div>
