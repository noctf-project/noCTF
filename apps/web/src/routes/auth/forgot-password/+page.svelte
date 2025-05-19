<script lang="ts">
  import { goto } from "$app/navigation";
  import { toasts } from "$lib/stores/toast";
  import Icon from "@iconify/svelte";
  import { header } from "../+layout.svelte";
  import loginState from "../auth.svelte";

  let currentStage = $state("forgot-password-request");
  let isLoading = $state(false);

  async function handleForgotPasswordRequest() {
    if (!loginState.email) {
      toasts.error("Please enter your email address.");
      return;
    }
    try {
      // TODO: Implement password reset request
      //   isLoading = true;
      // Replace with your actual API endpoint for initiating password reset
      // const resetReq = await api.POST("/auth/password/reset/init", {
      //   body: { email },
      // });

      // if (resetReq.error) {
      //   console.error("Password reset request error:", resetReq.error);
      //   toasts.error(
      //     "Failed to request password reset. Please try again later.",
      //   );
      //   isLoading = false;
      //   return;
      // }

      currentStage = "forgot-password-sent";
      toasts.success("Password reset instructions sent");
    } catch (error) {
      console.error("Password reset submission error:", error);
      toasts.error("An unexpected error occurred. Please try again later.");
    } finally {
      // isLoading will be set false by stage change if successful, or explicitly on error above
      if (currentStage !== "forgot-password-sent") {
        isLoading = false;
      }
    }
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    handleForgotPasswordRequest();
  }
</script>

{#if currentStage === "forgot-password-request"}
  {@render header(
    "Reset Password",
    "Confirm your email to receive password reset instructions",
  )}
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
          onclick={() => goto("/auth")}
          title="Change email"
        >
          <Icon icon="material-symbols:edit" class="w-5 h-5" />
        </button>
      </div>
    </div>

    <button
      class="btn btn-primary w-full mt-6 shadow-solid"
      type="submit"
      disabled={isLoading || !loginState.email}
    >
      {#if isLoading}
        <span class="loading loading-spinner loading-sm"></span>
      {:else}
        Send Reset Link
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

{#if currentStage === "forgot-password-sent"}
  {@render header("Check your email", "Password reset instructions sent")}
  <div class="pb-4 flex flex-col items-center">
    <div class="rounded-full flex items-center justify-center mb-4">
      <Icon icon="material-symbols:mail-outline" class="text-4xl" />
    </div>

    <p class="text-center mb-4">
      If an account exists for <strong>{loginState.email}</strong>, you will
      receive an email with instructions on how to reset your password shortly.
    </p>

    <p class="text-sm text-gray-500 mb-6">
      Please check your inbox (and spam folder). The link will expire for
      security reasons.
    </p>

    <button
      class="btn btn-outline w-full"
      onclick={() => (currentStage = "email")}
    >
      Back to Start
    </button>
  </div>
{/if}
