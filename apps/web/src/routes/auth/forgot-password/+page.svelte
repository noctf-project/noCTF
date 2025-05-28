<script lang="ts">
  import { goto } from "$app/navigation";
  import { toasts } from "$lib/stores/toast";
  import Icon from "@iconify/svelte";
  import api from "$lib/api/index.svelte";
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
      isLoading = true;
      const resetReq = await api.POST("/auth/email/reset", {
        body: { email: loginState.email },
      });

      if (resetReq.error) {
        console.error("Password reset request error:", resetReq.error);
        toasts.error(
          "Failed to request password reset. Please try again later.",
        );
        isLoading = false;
        return;
      }

      currentStage = "forgot-password-sent";
    } catch (error) {
      console.error("Password reset submission error:", error);
      toasts.error("An unexpected error occurred. Please try again later.");
    } finally {
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
      class="btn btn-primary w-full mt-6 pop hover:pop"
      type="submit"
      disabled={isLoading || !loginState.email}
    >
      {#if isLoading}
        <span class="loading loading-spinner loading-sm"></span>
      {:else}
        Send Reset Link
      {/if}
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
      An email has been sent to <strong>{loginState.email}</strong> with instructions
      on how to reset your password.
    </p>

    <p class="text-sm text-center text-gray-500 mb-6">
      Please check your inbox and spam folder.
    </p>
  </div>
{/if}
