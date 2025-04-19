<script lang="ts">
  import api, { SESSION_TOKEN_KEY } from "$lib/api/index.svelte";
  import { toasts } from "$lib/stores/toast";
  import { performRedirect } from "$lib/utils/url";
  import Icon from "@iconify/svelte";
  import { goto } from "$app/navigation";
  import loginState from "./auth.svelte";

  let isLoading = $state(false);
  loginState.currentStage = "email";

  const oAuthProviders = [
    { name: "Google", icon: "mdi:google" },
    { name: "GitHub", icon: "mdi:github" },
  ];
  
  async function handleEmailCheck() {
    if (!loginState.email) return;

    try {
      isLoading = true;

      await loginState.checkEmail();
    } catch (error) {
      toasts.error("An error occurred during email check");
      console.error(error);
    } finally {
      isLoading = false;
    }
  }

  async function handleSocialLogin(provider: string) {
    // TODO: Redirect to social login provider went implemented
    // window.location.href = `/auth/${provider}/init?redirect_to=${encodeURIComponent(redirectParam || "/")}`;
    toasts.info(
      `Social login with ${provider} is not implemented yet. Please use email login.`,
    );
  }

  // TODO: Implement when password reset API is available
  async function handleForgotPasswordRequest() {
    // if (!email) {
    //   toasts.error("Please enter your email address.");
    //   return;
    // }
    try {
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

      loginState.currentStage = "forgot-password-sent";
      toasts.success("Password reset instructions sent (if account exists).");
    } catch (error) {
      console.error("Password reset submission error:", error);
      toasts.error("An unexpected error occurred. Please try again later.");
    } finally {
      // isLoading will be set false by stage change if successful, or explicitly on error above
      if (loginState.currentStage !== "forgot-password-sent") {
        isLoading = false;
      }
    }
  }

  function handleSubmit(e: Event) {
    e.preventDefault();

    switch (loginState.currentStage) {
      case "email":
        handleEmailCheck();
        break;
      case "forgot-password-request":
        handleForgotPasswordRequest();
        break;
      default:
        break;
    }
  }
</script>

<div class="text-center mb-6">
  {#if loginState.currentStage === "email"}
    <h2 class="text-2xl font-bold">Welcome</h2>
    <p class="text-gray-600">Sign in or create an account</p>
  {:else if loginState.currentStage === "forgot-password-request"}
    <h2 class="text-2xl font-bold">Reset Password</h2>
    <p class="text-gray-600">Enter your email to receive reset instructions</p>
  {:else if loginState.currentStage === "forgot-password-sent"}
    <h2 class="text-2xl font-bold">Check your email</h2>
    <p class="text-gray-600">Password reset instructions sent</p>
  {/if}
</div>

{#if loginState.currentStage === "email"}
  <form onsubmit={handleSubmit}>
    <div class="form-control">
      <label for="email" class="label">
        <span class="label-text">Email</span>
      </label>
      <input
        autofocus
        id="email"
        type="email"
        placeholder="email@example.com"
        class="input input-bordered w-full"
        bind:value={loginState.email}
        required
        autocomplete="email"
      />
    </div>

    <button
      class="btn btn-primary w-full mt-6 shadow-solid"
      type="submit"
      disabled={isLoading || !loginState.email}
    >
      {#if isLoading}
        <span class="loading loading-spinner loading-sm"></span>
      {:else}
        Continue
      {/if}
    </button>
  </form>

  <div class="divider text-sm text-gray-500 my-6">OR</div>

  <div class="flex flex-col gap-3">
    {#each oAuthProviders as provider}
      <button
        class="btn btn-outline w-full"
        onclick={() => handleSocialLogin(provider.name.toLowerCase())}
      >
        <Icon icon={provider.icon} class="w-5 h-5 mr-2" />
        Continue with {provider.name}
      </button>
    {/each}
  </div>
{/if}

{#if loginState.currentStage === "forgot-password-request"}
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
          onclick={loginState.goBack}
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
      onclick={() => (loginState.currentStage = "login")}
      disabled={isLoading}
    >
      Back to Login
    </button>
  </form>
{/if}

{#if loginState.currentStage === "forgot-password-sent"}
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
      onclick={() => (loginState.currentStage = "email")}
    >
      Back to Start
    </button>
  </div>
{/if}
