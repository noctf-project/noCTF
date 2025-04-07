<script lang="ts">
  import api from "$lib/api/index.svelte";
  import { toasts } from "$lib/stores/toast";
  import { performRedirect } from "$lib/utils/url";
  import Icon from "@iconify/svelte";
  import { onMount } from "svelte";

  type FlowStage =
    | "email"
    | "login"
    | "register"
    | "verification-sent"
    | "forgot-password-request"
    | "forgot-password-sent";

  let currentStage: FlowStage = $state("email");
  // let currentStage: FlowStage = $state("register");

  // Form fields
  let email = $state("");
  let username = $state("");
  let password = $state("");
  let confirmPassword = $state("");
  let rememberMe = $state(true);

  // UI states
  let isLoading = $state(false);
  let passwordVisible = $state(false);
  let passwordStrength = $state(0);
  let registrationToken = $state("");
  let emailVerificationEnabled = $state(false); // This should be set based on your config

  // URL params
  let urlParams = new URLSearchParams(window.location.search);
  let clientId = urlParams.get("client_id");
  let redirectParam = urlParams.get("redirect_to");

  const oAuthProviders = [
    { name: "Google", icon: "mdi:google" },
    { name: "GitHub", icon: "mdi:github" },
  ];

  onMount(() => {
    // Could load verification config here
    // api.GET("/auth/config").then(res => {
    //   emailVerificationEnabled = res.data?.emailVerificationEnabled ?? true;
    // });
  });

  function successRedirect() {
    if (redirectParam) {
      performRedirect(redirectParam);
    } else {
      window.location.replace("/");
    }
  }

  function goBack() {
    // Generally goes back to email stage, except from password reset flow
    if (
      currentStage === "login" ||
      currentStage === "register" ||
      currentStage === "verification-sent"
    ) {
      currentStage = "email";
      // Reset sensitive fields when going back
      password = "";
      confirmPassword = "";
    }
    // Specific back buttons are used for forgot password flow stages
  }

  async function handleEmailCheck() {
    if (!email) return;

    try {
      isLoading = true;

      // Check if the email exists
      const checkEmailReq = await api.POST("/auth/email/init", {
        body: { email },
      });

      if (checkEmailReq.error) {
        toasts.error(checkEmailReq.error.message ?? "An unexpected error occurred when validating email. Please try again later.");
        isLoading = false;
        return;
      }
      console.log(checkEmailReq);

      // Handle different responses based on if email exists
      if (
        checkEmailReq.data &&
        Object.keys(checkEmailReq.data.data || {}).length === 0
      ) {
        // Email exists, proceed to login
        currentStage = "login";
      } else if (checkEmailReq.data?.data?.token) {
        // New user, store token for registration
        registrationToken = checkEmailReq.data.data.token;

        if (emailVerificationEnabled) {
          // If email verification is enabled, show verification message
          currentStage = "verification-sent";
        } else {
          // If email verification is disabled, go to registration form
          currentStage = "register";
        }
      } else {
        // Unexpected response
        toasts.error("Unexpected response from server");
      }
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

  async function handleLogin() {
    try {
      isLoading = true;

      const loginReq = await api.POST("/auth/email/finish", {
        body: {
          email,
          password,
          remember: rememberMe,
        },
      });

      if (loginReq.error) {
        toasts.error(loginReq.error.message);
        isLoading = false;
        return;
      }

      if (loginReq.data?.data?.type === "session") {
        successRedirect();
      } else {
        toasts.error("Login failed");
      }
    } catch (error) {
      toasts.error("An error occurred during login");
      console.error(error);
    } finally {
      isLoading = false;
    }
  }

  async function handleRegister() {
    try {
      isLoading = true;

      // Password validation
      if (password !== confirmPassword) {
        toasts.error("Passwords do not match");
        isLoading = false;
        return;
      }

      const registerReq = await api.POST("/auth/register/finish", {
        body: {
          token: registrationToken,
          username,
          email,
          password,
          captcha: "", // Assuming captcha is handled elsewhere or not needed here
        },
      });

      if (registerReq.error) {
        toasts.error(registerReq.error.message);
        isLoading = false;
        return;
      }

      if (registerReq.data?.data?.type === "session") {
        toasts.success("Account created successfully!");
        successRedirect();
      } else {
        toasts.error("Registration failed");
      }
    } catch (error) {
      toasts.error("An error occurred during registration");
      console.error(error);
    } finally {
      isLoading = false;
    }
  }

  async function handleForgotPasswordRequest() {
    if (!email) {
      toasts.error("Please enter your email address.");
      return;
    }
    try {
      isLoading = true;
      // Replace with your actual API endpoint for initiating password reset
      const resetReq = await api.POST("/auth/password/reset/init", {
        body: { email },
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
      toasts.success("Password reset instructions sent (if account exists).");
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

    switch (currentStage) {
      case "email":
        handleEmailCheck();
        break;
      case "login":
        handleLogin();
        break;
      case "register":
        handleRegister();
        break;
      case "forgot-password-request":
        handleForgotPasswordRequest();
        break;
      default:
        break;
    }
  }
</script>

<div class="h-full flex flex-col gap-8 items-center justify-center p-4">
  {#if clientId}
    <h2 class="text-xl text-center">
      Log in to grant access to <span class="font-bold">{clientId}</span>
    </h2>
  {/if}

  <div
    class="card w-full max-w-md bg-base-100 shadow-solid border border-base-500"
  >
    <div class="card-body">
      <div class="text-center mb-6">
        {#if currentStage === "email"}
          <h2 class="text-2xl font-bold">Welcome</h2>
          <p class="text-gray-600">Sign in or create an account</p>
        {:else if currentStage === "login"}
          <h2 class="text-2xl font-bold">Welcome back</h2>
          <p class="text-gray-600">Enter your password to continue</p>
        {:else if currentStage === "register"}
          <h2 class="text-2xl font-bold">Create an account</h2>
          <p class="text-gray-600">Complete your details to get started</p>
        {:else if currentStage === "verification-sent"}
          <h2 class="text-2xl font-bold">Check your email</h2>
          <p class="text-gray-600">We've sent a verification link</p>
        {:else if currentStage === "forgot-password-request"}
          <h2 class="text-2xl font-bold">Reset Password</h2>
          <p class="text-gray-600">
            Enter your email to receive reset instructions
          </p>
        {:else if currentStage === "forgot-password-sent"}
          <h2 class="text-2xl font-bold">Check your email</h2>
          <p class="text-gray-600">Password reset instructions sent</p>
        {/if}
      </div>

      {#if currentStage === "email"}
        <form onsubmit={handleSubmit}>
          <div class="form-control">
            <label for="email" class="label">
              <span class="label-text">Email</span>
            </label>
            <input
              id="email"
              type="email"
              placeholder="email@example.com"
              class="input input-bordered w-full"
              bind:value={email}
              required
              autocomplete="email"
            />
          </div>

          <button
            class="btn btn-primary w-full mt-6 shadow-solid"
            type="submit"
            disabled={isLoading || !email}
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
          <!-- <button
            class="btn btn-outline w-full"
            onclick={() => handleSocialLogin("google")}
          >
            Continue with Google
          </button>
          <button
            class="btn btn-outline w-full"
            onclick={() => handleSocialLogin("github")}
          >
            Continue with GitHub
          </button> -->
        </div>
      {/if}

      {#if currentStage === "login"}
        <form onsubmit={handleSubmit}>
          <div class="form-control">
            <label for="email-locked" class="label">
              <span class="label-text">Email</span>
            </label>
            <div class="relative">
              <input
                id="email-locked"
                type="email"
                class="input input-bordered w-full pr-10 bg-base-200"
                value={email}
                disabled
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                onclick={goBack}
                title="Change email"
              >
                <Icon icon="material-symbols:edit" class="w-5 h-5" />
              </button>
            </div>
          </div>

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
                bind:value={password}
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
                  <Icon
                    icon="material-symbols:visibility-outline"
                    class="w-5 h-5"
                  />
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
                  bind:checked={rememberMe}
                />
                <span class="label-text text-sm">Remember me</span>
              </label>
            </div>
            <button
              type="button"
              class="text-sm link link-hover self-end"
              onclick={() => (currentStage = "forgot-password-request")}
            >
              Forgot password?
            </button>
          </div>

          <button
            class="btn btn-primary w-full mt-6 shadow-solid"
            type="submit"
            disabled={isLoading || !password}
          >
            {#if isLoading}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              Sign In
            {/if}
          </button>
        </form>
      {/if}

      {#if currentStage === "register"}
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
                value={email}
                disabled
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                onclick={goBack}
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
              id="name"
              type="text"
              placeholder="Your name"
              class="input input-bordered w-full"
              bind:value={username}
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
                bind:value={password}
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
            disabled={isLoading ||
              !username ||
              !password ||
              password !== confirmPassword ||
              passwordStrength < 3}
          >
            {#if isLoading}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              Create Account
            {/if}
          </button>
        </form>
      {/if}

      {#if currentStage === "verification-sent"}
        <div class="pb-4 flex flex-col items-center">
          <div
            class="bg-info/20 text-info rounded-full flex items-center justify-center pb-4"
          >
            <Icon icon="material-symbols:mail-outline" class="text-4xl" />
          </div>

          <p class="text-center mb-4">
            We've sent a verification link to <strong>{email}</strong>. Please
            check your inbox and click the link to complete registration.
          </p>

          <p class="text-sm text-gray-500 mb-6">
            If you don't see the email, check your spam folder.
          </p>

          <button class="btn btn-outline w-full" onclick={goBack}>
            Use a different email
          </button>
        </div>
      {/if}

      {#if currentStage === "forgot-password-request"}
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
                value={email}
                disabled
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                onclick={goBack}
                title="Change email"
              >
                <Icon icon="material-symbols:edit" class="w-5 h-5" />
              </button>
            </div>
          </div>

          <button
            class="btn btn-primary w-full mt-6 shadow-solid"
            type="submit"
            disabled={isLoading || !email}
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
            onclick={() => (currentStage = "login")}
            disabled={isLoading}
          >
            Back to Login
          </button>
        </form>
      {/if}

      {#if currentStage === "forgot-password-sent"}
        <div class="py-4 flex flex-col items-center">
          <div
            class="w-16 h-16 bg-success/20 text-success rounded-full flex items-center justify-center mb-4"
          >
            <Icon
              icon="material-symbols:mark-email-outline"
              class="w-16 h-16"
            />
          </div>

          <p class="text-center mb-4">
            If an account exists for <strong>{email}</strong>, you will receive
            an email with instructions on how to reset your password shortly.
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
    </div>
  </div>

  <div class="text-sm text-gray-500 text-center max-w-md">
    By continuing, you agree to our <a href="/terms" class="link"
      >Terms of Service</a
    >
    and <a href="/privacy" class="link">Privacy Policy</a>.
  </div>
</div>
