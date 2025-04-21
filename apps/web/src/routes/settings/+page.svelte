<script lang="ts">
  import Icon from "@iconify/svelte";
  import { toasts } from "$lib/stores/toast";
  import { onMount } from "svelte";
  import authState from "$lib/state/auth.svelte";
  import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";

  type TabType = "profile" | "account" | "security" | "preferences";

  let activeTab = $state<TabType>("profile");
  let emailVerified = $state(true);

  let profileForm = $state({
    name: "",
    bio: "",
  });

  let accountForm = $state({
    email: "",
    newEmailSent: false,
  });

  let securityForm = $state({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  let isUpdatingProfile = $state(false);
  let isUpdatingEmail = $state(false);
  let isUpdatingPassword = $state(false);

  async function updateProfile() {
    try {
      isUpdatingProfile = true;
      await new Promise((resolve) => setTimeout(resolve, 800));

      console.log("Profile updated:", profileForm);
      toasts.success("Profile updated successfully!");
    } catch (error) {
      console.error("Failed to update profile:", error);
      toasts.error("Failed to update profile. Please try again.");
    } finally {
      isUpdatingProfile = false;
    }
  }

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
      profileForm.name = authState.user.name;
      profileForm.bio = authState.user.bio;
      accountForm.email = authState.user.email || "";
    }
  });
</script>

{#snippet tab(id: TabType, title: string, icon: string)}
  <button
    tabindex="0"
    role="tab"
    class="rounded-lg text-left flex flex-row p-2 align-center {activeTab === id
      ? 'bg-primary text-primary-content'
      : ''} transition-all duration-200"
    onclick={() => (activeTab = id)}
  >
    <Icon {icon} class="text-2xl" />
    <div class="hidden sm:block ml-2">{title}</div>
  </button>
{/snippet}

<div class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
  <h1 class="text-4xl font-bold mb-8">Settings</h1>

  <div class="flex flex-row gap-4">
    <div
      class="flex flex-col tabs-boxed bg-base-100 p-1 h-fit pop align w-14 sm:w-48"
    >
      {@render tab("profile", "Profile", "material-symbols:account-circle")}
      {@render tab("account", "Account", "material-symbols:person-book")}
      {@render tab("security", "Security", "material-symbols:lock")}
      {@render tab(
        "preferences",
        "Preferences",
        "material-symbols:palette-outline",
      )}
    </div>

    <div class="card bg-base-100 pop rounded-lg w-full">
      <div class="card-body">
        {#if activeTab === "profile"}
          <div class="space-y-6">
            <h2 class="text-2xl font-bold">Profile</h2>
            <p class="text-base-content/70">
              Your profile information that will be displayed to other users
            </p>

            <div class="form-control w-full">
              <label class="label" for="username">
                <span class="label-text">Username</span>
              </label>
              <input
                id="username"
                type="text"
                bind:value={profileForm.name}
                placeholder="Your username"
                class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
              />
            </div>

            <div class="form-control w-full">
              <label class="label" for="bio">
                <span class="label-text">Bio</span>
              </label>
              <textarea
                id="bio"
                bind:value={profileForm.bio}
                placeholder="Tell us about yourself"
                class="input input-bordered h-32 w-full focus:outline-none focus:ring-0 focus:ring-offset-0 pt-2"
              ></textarea>
            </div>

            <div class="flex justify-end">
              <button
                class="btn btn-primary pop hover:pop"
                onclick={updateProfile}
                disabled={isUpdatingProfile}
              >
                {#if isUpdatingProfile}
                  <span class="loading loading-spinner loading-sm"></span>
                  Saving...
                {:else}
                  Save Changes
                {/if}
              </button>
            </div>
          </div>
        {:else if activeTab === "account"}
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
        {:else if activeTab === "security"}
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
        {:else if activeTab === "preferences"}
          <div class="space-y-6">
            <h2 class="text-2xl font-bold">Preferences</h2>

            <div>
              <h3 class="text-lg font-semibold mb-4">Theme</h3>
              <div class="card bg-base-200 p-4 rounded-lg">
                <div
                  class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                >
                  <div>
                    <p class="font-medium">Colour Theme</p>
                    <p class="text-sm text-base-content/70">
                      Choose your preferred colour theme
                    </p>
                  </div>
                  <button class="btn btn-primary pop hover:pop pl-1 pr-4">
                    <ThemeSwitcher detailed={true} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
