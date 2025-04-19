<script lang="ts">
  import Icon from "@iconify/svelte";
  import loginState from "../auth.svelte";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { toasts } from "$lib/stores/toast";
  import { emailLocked, header } from "../+layout.svelte";

  let passwordVisible = $state(false);
  let isLoading = $state(true);
  let registrationViaToken = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    try {
      isLoading = true;
      if (await loginState.register()) goto("/");
    } catch (error) {
      toasts.error("An error occurred during registration");
      console.error(error);
    } finally {
      isLoading = false;
    }
  }

  // Check for the token in the URL for validation
  onMount(async () => {
    loginState.password = "";
    // Cannot use existing loginState.urlParams as it does not update across routes
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (token) {
      // If a token exists in the URL, try to validate it
      registrationViaToken = true;
      try {
        await loginState.verifyToken(token);
      } catch (e) {
        console.error("Error during token verification:", e);
        toasts.error("An error occurred while verifying the token.");
        goto("/auth");
      } finally {
        isLoading = false;
      }
    } else if (!loginState.email) {
      // No token in URL AND no email in state (user landed here directly)
      goto("/auth");
    } else {
      // No token, but email IS in state (user came from email entry step)
      // and email verification is not turned on
      isLoading = false; // No token check needed, ready to show form
    }
  });
</script>

{@render header("Create an account", "Complete your details to get started")}

<form onsubmit={handleSubmit}>
  {@render emailLocked({ showEditButton: !registrationViaToken })}

  <div class="form-control mt-4">
    <label for="name" class="label">
      <span class="label-text">Username</span>
    </label>
    <input
      autofocus
      id="name"
      type="text"
      placeholder="Your name"
      class="input input-bordered w-full"
      bind:value={loginState.username}
      required
      autocomplete="name"
    />
  </div>

  <div class="form-control mt-4">
    <label for="password-reg" class="label">
      <span class="label-text">Password</span>
    </label>
    <div class="relative">
      <input
        id="password-reg"
        type={passwordVisible ? "text" : "password"}
        placeholder="••••••••"
        class="input input-bordered w-full pr-10"
        bind:value={loginState.password}
        required
        autocomplete="new-password"
        minlength={8}
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

  <button
    class="btn btn-primary w-full mt-6 pop hover:pop"
    type="submit"
    disabled={isLoading || !loginState.username || !loginState.password}
  >
    {#if isLoading}
      <span class="loading loading-spinner loading-sm"></span>
    {:else}
      Create Account
    {/if}
  </button>
</form>
