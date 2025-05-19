<script lang="ts">
  import Icon from "@iconify/svelte";
  import { toasts } from "$lib/stores/toast";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import { onMount } from "svelte";
  import { replaceState } from "$app/navigation";

  let isProcessingToken = $state(false);
  let resendCooldown = $state(0);
  let cooldownInterval: ReturnType<typeof setInterval> | undefined =
    $state(undefined);

  let accountForm = $state({
    email: "",
    password: "",
  });

  let newEmailSent = $state(false);
  let isUpdatingEmail = $state(false);
  let userIdentities = wrapLoadable(api.GET("/user/me/identities"));

  async function refreshUserIdentities() {
    try {
      const r = await api.GET("/user/me/identities", {});
      userIdentities.r = r;
      userIdentities.loading = false;
      userIdentities.error = undefined;
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

      const initResponse = await api.POST("/auth/email/change", {
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
        newEmailSent = true;
        startCooldown();
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
      newEmailSent = false;
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
      await api.POST("/auth/email/change", {
        body: {
          email: accountForm.email,
          password: accountForm.password,
        },
      });

      toasts.success("Verification email sent. Please check your inbox.");
      startCooldown();
    } catch (error) {
      console.error("Failed to resend verification email:", error);
      toasts.error("Failed to resend verification email: " + error);
    }
  }

  function startCooldown() {
    resendCooldown = 120;
    if (cooldownInterval) {
      clearInterval(cooldownInterval);
    }

    cooldownInterval = setInterval(() => {
      resendCooldown = resendCooldown - 1;
      if (resendCooldown <= 0) {
        clearInterval(cooldownInterval);
        cooldownInterval = undefined;
      }
    }, 1000);
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

  onMount(() => {
    (async () => {
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
    })();

    return () => {
      if (cooldownInterval) {
        clearInterval(cooldownInterval);
      }
    };
  });
</script>

<div class="space-y-6">
  <h2 class="text-2xl font-bold">Account</h2>

  <form onsubmit={updateEmail} class="form-control w-full flex flex-col gap-4">
    <div>
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
          disabled={newEmailSent || isProcessingToken}
          required
          autocomplete="email"
        />
      {/if}
    </div>

    {#if !newEmailSent}
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

    {#if newEmailSent}
      <div class="alert alert-info">
        <Icon icon="material-symbols:info" class="text-lg" />
        <span>
          A verification email has been sent to <strong
            >{accountForm.email}</strong
          >. Please check your inbox and click the verification link. Your email
          will not be updated until you confirm it.
        </span>
      </div>

      <div class="flex flex-wrap gap-4 mt-4">
        <button
          class="btn btn-primary pop hover:pop"
          type="button"
          onclick={resendVerificationEmail}
          disabled={isProcessingToken || resendCooldown > 0}
        >
          <Icon icon="material-symbols:mail" class="text-xl" />
          {#if resendCooldown > 0}
            Resend in {resendCooldown}s
          {:else}
            Resend Verification Email
          {/if}
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
