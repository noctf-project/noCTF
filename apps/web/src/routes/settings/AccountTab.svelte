<script lang="ts">
  import Icon from "@iconify/svelte";
  import { toasts } from "$lib/stores/toast";
  import { onMount } from "svelte";
  import authState from "$lib/state/auth.svelte";

  let emailVerified = $state(true);

  let accountForm = $state({
    email: "",
    newEmailSent: false,
  });

  let isUpdatingEmail = $state(false);

  async function updateEmail() {
    if (accountForm.email === authState.user?.email) {
      toasts.info("The email address is the same as your current one.");
      return;
    }

    try {
      isUpdatingEmail = true;
      await new Promise((resolve) => setTimeout(resolve, 800));

      console.log("Email updated:", accountForm.email);

      accountForm.newEmailSent = true;
      emailVerified = false;

      toasts.success(
        "Verification email has been sent to your new email address.",
      );
    } catch (error) {
      console.error("Failed to update email:", error);
      toasts.error("Failed to update email. Please try again.");
    } finally {
      isUpdatingEmail = false;
    }
  }

  function resendVerificationEmail() {
    console.log("Resending verification email to:", accountForm.email);
    toasts.success("Verification email sent. Please check your inbox.");
  }

  function cancelEmailChange() {
    accountForm.email = authState.user?.email || "";
    accountForm.newEmailSent = false;
    emailVerified = true;
    toasts.info("Email change cancelled.");
  }

  onMount(() => {
    if (authState.user) {
      accountForm.email = authState.user.email || "";
    }
  });
</script>

<div class="space-y-6">
  <h2 class="text-2xl font-bold">Account</h2>
  {#if !emailVerified}
    <div class="alert alert-warning">
      <Icon icon="material-symbols:warning" class="text-lg" />
      <span
        >Your email address is not verified. Please check your inbox
        for a verification link.</span
      >
    </div>
  {/if}

  <form
    onsubmit={updateEmail}
    class="form-control w-full flex flex-col gap-4"
  >
    <div>
      <label class="label" for="email">
        <span class="label-text">Email Address</span>
        {#if emailVerified}
          <span
            class="label-text-alt text-success flex items-center gap-1"
          >
            <Icon icon="material-symbols:check-circle" />
            Verified
          </span>
        {/if}
      </label>
      <input
        id="email"
        type="email"
        bind:value={accountForm.email}
        placeholder="Your email address"
        class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
        disabled={accountForm.newEmailSent}
        required
        autocomplete="email"
      />
    </div>

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
          onclick={resendVerificationEmail}
        >
          <Icon icon="material-symbols:mail" class="mr-2" />
          Resend Verification Email
        </button>

        <button
          class="btn btn-ghost pop hover:pop"
          onclick={cancelEmailChange}
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
          disabled={isUpdatingEmail}
        >
          {#if isUpdatingEmail}
            <span class="loading loading-spinner loading-sm"></span>
            Updating...
          {:else}
            Update Email
          {/if}
        </button>
      </div>
    {/if}
  </form>
</div>
