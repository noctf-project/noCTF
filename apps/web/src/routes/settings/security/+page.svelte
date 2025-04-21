<script lang="ts">
  import { toasts } from "$lib/stores/toast";

  let securityForm = $state({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  let isUpdatingPassword = $state(false);

  async function updatePassword() {
    if (!securityForm.currentPassword) {
      toasts.error("Please enter your current password.");
      return;
    }

    if (!securityForm.newPassword) {
      toasts.error("Please enter a new password.");
      return;
    }

    if (securityForm.newPassword !== securityForm.confirmPassword) {
      toasts.error("New passwords do not match.");
      return;
    }

    if (securityForm.newPassword.length < 8) {
      toasts.error("New password must be at least 8 characters long.");
      return;
    }

    try {
      isUpdatingPassword = true;
      await new Promise((resolve) => setTimeout(resolve, 800));

      console.log("Password updated");

      securityForm.currentPassword = "";
      securityForm.newPassword = "";
      securityForm.confirmPassword = "";

      toasts.success("Password updated successfully!");
    } catch (error) {
      console.error("Failed to update password:", error);
      toasts.error(
        "Failed to update password. Current password may be incorrect.",
      );
    } finally {
      isUpdatingPassword = false;
    }
  }
</script>

<div class="space-y-6">
  <h2 class="text-2xl font-bold">Security</h2>
  <p class="text-base-content/70">Change password</p>

  <div class="form-control w-full">
    <label class="label" for="current-password">
      <span class="label-text">Current Password</span>
    </label>
    <input
      id="current-password"
      type="password"
      bind:value={securityForm.currentPassword}
      placeholder="Enter your current password"
      class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
    />
  </div>

  <div class="form-control w-full">
    <label class="label" for="new-password">
      <span class="label-text">New Password</span>
    </label>
    <input
      id="new-password"
      type="password"
      bind:value={securityForm.newPassword}
      placeholder="Enter new password"
      class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
    />
  </div>

  <div class="form-control w-full">
    <label class="label" for="confirm-password">
      <span class="label-text">Confirm New Password</span>
    </label>
    <input
      id="confirm-password"
      type="password"
      bind:value={securityForm.confirmPassword}
      placeholder="Confirm new password"
      class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
    />
    <div class="text-xs text-base-content/70 mt-1 ml-1">
      Password must be at least 8 characters long.
    </div>
  </div>

  <div class="flex justify-end">
    <button
      class="btn btn-primary pop hover:pop"
      onclick={updatePassword}
      disabled={isUpdatingPassword}
    >
      {#if isUpdatingPassword}
        <span class="loading loading-spinner loading-sm"></span>
        Updating...
      {:else}
        Update Password
      {/if}
    </button>
  </div>
</div>
