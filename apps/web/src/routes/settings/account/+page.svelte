<script lang="ts">
  import Icon from "@iconify/svelte";
  import { toasts } from "$lib/stores/toast";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import { onMount } from "svelte";
  import { replaceState } from "$app/navigation";

  let emailVerified = $state(true);
  let isProcessingToken = $state(false);

  let accountForm = $state({
    email: "",
    password: "",
    newEmailSent: false,
  });

  let isUpdatingEmail = $state(false);
  let userIdentities = wrapLoadable(api.GET("/user/me/identities"));

  async function refreshUserIdentities() {
    try {
      const r = await api.GET("/user/me/identities", {});
      userIdentities.r = r;
      accountForm.email = getCurrentEmail();
    } catch (error) {
      console.error("Failed to fetch user identities:", error);
      toasts.error("Failed to fetch user identities: " + error);
      return;
    }
  }

  async function updateEmail(e: Event) {
    e.preventDefault();

    if (!accountForm.password) {
      toasts.error("Please enter your current password");
      return;
    }

    if (accountForm.email === getCurrentEmail()) {
      toasts.info("The email address is the same as your current one.");
      return;
    }

    try {
      isUpdatingEmail = true;

      const initResponse = await api.POST("/auth/email/change/init", {
        body: {
          email: accountForm.email,
          password: accountForm.password,
        },
      });

      if (!initResponse.data) {
        throw new Error(
          initResponse.error?.message || "Failed to initiate email change",
        );
      }

      if (initResponse.data.message) {
        accountForm.newEmailSent = true;
        emailVerified = false;
        toasts.success(
          "Verification email has been sent to your new email address.",
        );
      } else {
        await refreshUserIdentities();
        accountForm.email = getCurrentEmail();
        toasts.success("Email updated successfully!");
      }
    } catch (error) {
      console.error("Failed to update email:", error);
      toasts.error("Failed to update email: " + error);
    } finally {
      isUpdatingEmail = false;
    }
  }

  async function finishEmailChange(token: string) {
    try {
      const finishResponse = await api.POST("/auth/associate", {
        body: {
          token: token,
        },
      });

      if (!finishResponse.data) {
        throw new Error(
          finishResponse.error?.message || "Failed to complete email change",
        );
      }

      accountForm.password = "";
      accountForm.newEmailSent = false;
      emailVerified = true;
      await refreshUserIdentities();
      accountForm.email = getCurrentEmail();
      toasts.success("Email updated successfully!");
    } catch (error) {
      console.error("Failed to complete email change:", error);
      toasts.error("Failed to complete email change: " + error);
    }
  }

  async function resendVerificationEmail() {
    try {
      await api.POST("/auth/email/change/init", {
        body: {
          email: accountForm.email,
          password: accountForm.password,
        },
      });

      toasts.success("Verification email sent. Please check your inbox.");
    } catch (error) {
      console.error("Failed to resend verification email:", error);
      toasts.error("Failed to resend verification email: " + error);
    }
  }

  function cancelEmailChange() {
    accountForm.email = getCurrentEmail();
    accountForm.password = "";
    accountForm.newEmailSent = false;
    emailVerified = true;
    toasts.info("Email change cancelled.");
  }

  function getCurrentEmail() {
    if (!userIdentities.loading && !userIdentities.error && userIdentities.r) {
      const emailIdentity = userIdentities.r.data?.data.find(
        (identity) => identity.provider === "email",
      );
      return emailIdentity?.provider_id || "";
    }
    return "";
  }

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      try {
        isProcessingToken = true;
        await finishEmailChange(token);

        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        replaceState(url.toString(), {});
      } catch (error) {
        console.error("Failed to process token:", error);
        toasts.error("Failed to process email verification token: " + error);
      } finally {
        isProcessingToken = false;
      }
    } else {
      await refreshUserIdentities();
    }
  });
</script>

<div class="space-y-6">
  <h2 class="text-2xl font-bold">Account</h2>

  {#if isProcessingToken}
    <div class="alert">
      <span class="loading loading-spinner loading-sm"></span>
      <span>Processing email verification...</span>
    </div>
  {:else if !emailVerified}
    <div class="alert alert-warning">
      <Icon icon="material-symbols:warning" class="text-lg" />
      <span
        >Your email address is not verified. Please check your inbox for a
        verification link.</span
      >
    </div>
  {/if}

  <form onsubmit={updateEmail} class="form-control w-full flex flex-col gap-4">
    <div>
      <label class="label" for="email">
        <span class="label-text">Email Address</span>
        {#if emailVerified && !userIdentities.loading && !userIdentities.error}
          <span class="label-text-alt text-success flex items-center gap-1">
            <Icon icon="material-symbols:check-circle" />
            Verified
          </span>
        {/if}
      </label>

      {#if userIdentities.loading}
        <div class="skeleton h-12 w-full"></div>
      {:else if userIdentities.error}
        <div class="alert alert-error">
          <Icon icon="material-symbols:error" class="text-lg" />
          <span>Failed to load email information. Please refresh the page.</span
          >
        </div>
      {:else}
        <input
          id="email"
          type="email"
          bind:value={accountForm.email}
          placeholder="Your email address"
          class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
          disabled={accountForm.newEmailSent || isProcessingToken}
          required
          autocomplete="email"
        />
      {/if}
    </div>

    {#if !accountForm.newEmailSent}
      <div class="form-control w-full">
        <label class="label" for="password">
          <span class="label-text">Password</span>
        </label>
        <input
          id="password"
          type="password"
          bind:value={accountForm.password}
          placeholder="Your current password"
          class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
          disabled={isProcessingToken}
        />
        <div class="text-xs text-base-content/70 mt-1 ml-1">
          Your current password is required to update your email
        </div>
      </div>
    {/if}

    {#if accountForm.newEmailSent}
      <div class="alert alert-info">
        <Icon icon="material-symbols:info" class="text-lg" />
        <span>
          A verification email has been sent to <strong
            >{accountForm.email}</strong
          >. Please check your inbox and click the verification link.
        </span>
      </div>

      <div class="flex flex-wrap gap-4 mt-4">
        <button
          class="btn btn-outline pop hover:pop"
          type="button"
          onclick={resendVerificationEmail}
          disabled={isProcessingToken}
        >
          <Icon icon="material-symbols:mail" class="mr-2" />
          Resend Verification Email
        </button>

        <button
          class="btn btn-ghost pop hover:pop"
          type="button"
          onclick={cancelEmailChange}
          disabled={isProcessingToken}
        >
          <Icon icon="material-symbols:cancel" class="mr-2" />
          Cancel Email Change
        </button>
      </div>
    {:else}
      <div class="flex justify-end">
        <button
          class="btn btn-primary pop hover:pop"
          type="submit"
          disabled={isUpdatingEmail ||
            userIdentities.loading ||
            userIdentities.error ||
            isProcessingToken}
        >
          {#if isUpdatingEmail}
            <span class="loading loading-spinner loading-sm"></span>
            Updating...
          {:else if userIdentities.loading}
            <span class="loading loading-spinner loading-sm"></span>
            Loading...
          {:else}
            Update Email
          {/if}
        </button>
      </div>
    {/if}
  </form>
</div>
