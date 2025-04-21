<script lang="ts">
  import { toasts } from "$lib/stores/toast";
  import { onMount } from "svelte";
  import authState from "$lib/state/auth.svelte";

  let profileForm = $state({
    name: "",
    bio: "",
  });

  let isUpdatingProfile = $state(false);

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

  onMount(() => {
    if (authState.user) {
      profileForm.name = authState.user.name;
      profileForm.bio = authState.user.bio;
    }
  });
</script>

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
