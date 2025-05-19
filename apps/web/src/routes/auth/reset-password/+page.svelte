<script lang="ts">
  import { goto } from "$app/navigation";
  import { toasts } from "$lib/stores/toast";
  import Icon from "@iconify/svelte";
  import { header } from "../+layout.svelte";
  import { page } from "$app/state";

  let isLoading = $state(false);
  let password = $state("");
  let confirmPassword = $state("");
  let resetToken = page.url.searchParams.get("token");
  let currentStage = $state("reset-form");

  // TODO: Implement password strength validation
  function validatePasswordStrength(password: string) {
    // if (password.length < 8) {
    // toasts.error("Password must be at least 8 characters long");
    // return false;
    // }
    return true;
  }

  async function handlePasswordReset() {
    if (!resetToken) {
      toasts.error("Invalid or missing reset token");
      return;
    }

    if (!password || !confirmPassword) {
      toasts.error("Please enter and confirm your new password");
      return;
    }

    if (password !== confirmPassword) {
      toasts.error("Passwords do not match");
      return;
    }

    if (!validatePasswordStrength(password)) {
      toasts.error("Password is too weak");
      return;
    }

    try {
      isLoading = true;
      // TODO: Implement password reset API call
      // const response = await api.POST("/auth/password/reset/confirm", {
      //   body: {
      //     token: resetToken,
      //     password: password,
      //   },
      // });

      // if (response.error) {
      //   throw new Error(response.error);
      // }

      toasts.success("Password has been reset successfully");
      currentStage = "success";
    } catch (error) {
      console.error("Password reset error:", error);
      toasts.error("Failed to reset password. Please try again.");
    } finally {
      isLoading = false;
    }
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    handlePasswordReset();
  }
</script>

{#if !resetToken}
  {@render header(
    "Invalid Reset Link",
    "This password reset link is invalid or has expired",
  )}
  <div class="pb-4 flex flex-col items-center">
    <div class="rounded-full flex items-center justify-center mb-4">
      <Icon icon="material-symbols:error-outline" class="text-4xl text-error" />
    </div>
    <p class="text-center mb-6">
      Please request a new password reset link from the login page.
    </p>
    <button
      class="btn btn-primary w-full"
      onclick={() => goto("/auth/forgot-password")}
    >
      Request New Reset Link
    </button>
  </div>
  <!-- Password reset success -->
{:else if currentStage === "success"}
  {@render header(
    "Password Updated",
    "Your password has been successfully reset",
  )}
  <div class="pb-4 flex flex-col items-center">
    <div class="rounded-full flex items-center justify-center mb-4">
      <Icon
        icon="material-symbols:check-circle-outline"
        class="text-4xl text-success"
      />
    </div>
    <p class="text-center mb-6">
      Your password has been successfully updated. You can now log in with your
      new password.
    </p>
    <button class="btn btn-primary w-full" onclick={() => goto("/auth/login")}>
      Back to Login
    </button>
  </div>
{:else}
  {@render header("Reset Password", "Enter your new password")}
  <form onsubmit={handleSubmit}>
    <div class="form-control">
      <label for="password" class="label">
        <span class="label-text">New Password</span>
      </label>
      <input
        id="password"
        type="password"
        class="input input-bordered w-full"
        bind:value={password}
        required
        autocomplete="new-password"
        minlength="8"
      />
    </div>
    <div class="form-control mt-4">
      <label for="confirm-password" class="label">
        <span class="label-text">Confirm Password</span>
      </label>
      <input
        id="confirm-password"
        type="password"
        class="input input-bordered w-full"
        bind:value={confirmPassword}
        required
        autocomplete="new-password"
        minlength="8"
      />
    </div>

    <button
      class="btn btn-primary w-full mt-6 shadow-solid"
      type="submit"
      disabled={isLoading || !password || !confirmPassword}
    >
      {#if isLoading}
        <span class="loading loading-spinner loading-sm"></span>
      {:else}
        Reset Password
      {/if}
    </button>

    <button
      type="button"
      class="btn btn-ghost w-full mt-3"
      onclick={() => goto("/auth/login")}
      disabled={isLoading}
    >
      Back to Login
    </button>
  </form>
{/if}
