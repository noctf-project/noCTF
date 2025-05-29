<script lang="ts">
  import Icon from "@iconify/svelte";
  import loginState from "../auth.svelte";
  import { goto } from "$app/navigation";
  import { emailLocked, header } from "../+layout.svelte";

  let isLoading = $state(false);
  let passwordVisible = $state(false);

  if (!loginState.email) {
    goto("/auth");
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();
    if (!loginState.email) return;
    try {
      isLoading = true;
      await loginState.login();
    } finally {
      isLoading = false;
    }
  }
</script>

{@render header("Welcome back", "Enter your password to continue")}

<form onsubmit={handleSubmit}>
  {@render emailLocked()}

  <div class="form-control mt-4">
    <label for="password" class="label">
      <span class="label-text">Password</span>
    </label>
    <div class="relative">
      <input
        id="password"
        type={passwordVisible ? "text" : "password"}
        placeholder="••••••••"
        class="input input-bordered w-full pr-10"
        bind:value={loginState.password}
        required
        autocomplete="current-password"
      />
      <button
        type="button"
        class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
        onclick={() => (passwordVisible = !passwordVisible)}
        title={passwordVisible ? "Hide password" : "Show password"}
      >
        {#if passwordVisible}
          <Icon
            icon="material-symbols:visibility-off-outline"
            class="w-5 h-5"
          />
        {:else}
          <Icon icon="material-symbols:visibility-outline" class="w-5 h-5" />
        {/if}
      </button>
    </div>
  </div>

  <div class="flex justify-between items-center mt-2">
    <div class="form-control">
      <label class="cursor-pointer label justify-start py-1">
        <input
          type="checkbox"
          class="checkbox checkbox-sm mr-2"
          bind:checked={loginState.rememberMe}
        />
        <span class="label-text text-sm">Remember me</span>
      </label>
    </div>
    <button
      type="button"
      class="text-sm link link-hover self-end"
      onclick={() => goto("/auth/forgot-password")}
    >
      Forgot password?
    </button>
  </div>

  <button
    class="btn btn-primary w-full mt-6 pop hover:pop"
    type="submit"
    disabled={isLoading || !loginState.password}
  >
    {#if isLoading}
      <span class="loading loading-spinner loading-sm"></span>
    {:else}
      Sign In
    {/if}
  </button>
</form>
