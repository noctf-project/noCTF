<script lang="ts">
  import api, { SESSION_TOKEN_KEY, wrapLoadable } from "$lib/api/index.svelte";
  import Icon from "@iconify/svelte";
  import loginState from "../auth.svelte";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { toasts } from "$lib/stores/toast";
  import { error } from "@sveltejs/kit";

  let passwordVisible = $state(false);
  let isLoading = $state(true);

  let urlParams = new URLSearchParams(window.location.search);
  let clientId = urlParams.get("client_id");
  let redirectParam = urlParams.get("redirect_to");
  let token = urlParams.get("token");

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

  async function handleEditEmail() {
    // This function is called when the user clicks the edit email button
    // It should redirect the user to the email entry step
    loginState.currentStage = "email";
    goto("/auth");
  }

  onMount(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    // const clientId = urlParams.get("client_id"); // Keep track if needed later
    // const redirectParam = urlParams.get("redirect_to"); // Keep track if needed later

    if (token) {
      // If a token exists in the URL, try to validate it
      try {
        const response = await api.POST("/auth/register/token", {
          body: { token },
        });

        if (response.error) {
          // Handle API error (invalid token, expired, etc.)
          console.error("Token verification failed:", response.error);
          const errorMessage =
            response.error?.message || "Invalid or expired registration link.";
          toasts.error(errorMessage);
          // Redirect back to the login page on failure
          loginState.currentStage = "email";
          goto("/auth");
          return;
        }

        // TODO: We can have multiple identities?
        if (response?.data?.data?.identity[0]?.provider_id) {
          const email = response.data.data.identity[0].provider_id;
          console.log("Token verified, email:", email);
          // Set the email in the shared state
          loginState.email = email;
          loginState.registrationToken = token;
          loginState.currentStage = "register"; // Ensure we are on the register stage
          isLoading = false; // Verification done, ready to show form
        }
      } catch (e) {
        // Handle network or other errors
        console.error("Error during token verification:", e);
        toasts.error("An error occurred while verifying the token.");
        loginState.currentStage = "email"; // Redirect to email entry step
        goto("/auth");
      }
    } else if (!loginState.email) {
      // No token in URL AND no email in state (user landed here directly)
      console.log("No token and no email in state, redirecting to /auth");
      goto("/auth");
    } else {
      // No token, but email IS in state (user came from email entry step)
      // and email verification is not turned on
      console.log(
        "No token, but email exists in state. Proceeding with registration form.",
      );
      loginState.currentStage = "register"; // Ensure stage is correct
      isLoading = false; // No token check needed, ready to show form
    }
  });
</script>

<div class="h-full flex flex-col gap-8 items-center justify-center p-4">
  <div
    class="card w-full max-w-md bg-base-100 shadow-solid border border-base-500"
  >
    <div class="card-body">
      <div class="text-center mb-6">
        <h2 class="text-2xl font-bold">Create an account</h2>
        <p class="text-gray-600">Complete your details to get started</p>
      </div>

      {#if loginState.currentStage === "register"}
        <form onsubmit={handleSubmit}>
          <div class="form-control">
            <label for="email-locked-reg" class="label">
              <span class="label-text">Email</span>
            </label>
            <div class="relative">
              <input
                id="email-locked-reg"
                type="email"
                class="input input-bordered w-full pr-10 bg-base-200"
                value={loginState.email}
                disabled
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                onclick={handleEditEmail}
                title="Change email"
              >
                <Icon icon="material-symbols:edit" class="w-5 h-5" />
              </button>
            </div>
          </div>

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
                  <Icon
                    icon="material-symbols:visibility-outline"
                    class="w-5 h-5"
                  />
                {/if}
              </button>
            </div>
          </div>

          <button
            class="btn btn-primary w-full mt-6 shadow-solid"
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
      {/if}
    </div>
  </div>

  <div class="text-sm text-gray-500 text-center max-w-md">
    By continuing, you agree to our <a href="/terms" class="link"
      >Terms of Service</a
    >
    and <a href="/privacy" class="link">Privacy Policy</a>.
  </div>
</div>
