<script lang="ts">
  import { toasts } from "$lib/stores/toast";
  import api, { wrapLoadable } from "$lib/api/index.svelte";

  let profileForm = $state({
    name: "",
    bio: "",
  });

  let isUpdatingProfile = $state(false);
  let userProfile = $state(wrapLoadable(fetchUserProfile()));

  async function fetchUserProfile() {
    const response = await api.GET("/user/me", {});
    if (!response.data) {
      toasts.error("Failed to fetch user profile: " + response.error?.message);
      return;
    }
    return response.data;
  }

  async function updateProfile() {
    try {
      isUpdatingProfile = true;

      const response = await api.PUT("/user/me", {
        body: {
          name: profileForm.name,
          bio: profileForm.bio,
        },
      });

      if (!response.data) {
        throw new Error(response.error?.message || "Unknown error occurred");
      }

      toasts.success("Profile updated successfully!");
    } catch (error) {
      console.error("Failed to update profile:", error);
      const message = error?.toString()?.includes("must match pattern")
        ? "Name contains invalid characters"
        : error;
      toasts.error("Failed to update profile: " + message);
    } finally {
      isUpdatingProfile = false;
    }
  }

  $effect(() => {
    if (!userProfile.loading && !userProfile.error && userProfile.r) {
      profileForm.name = userProfile.r.data.name;
      profileForm.bio = userProfile.r.data.bio;
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
    {#if userProfile.loading || userProfile.error}
      <div class="skeleton h-12 w-full"></div>
    {:else}
      <input
        id="username"
        type="text"
        bind:value={profileForm.name}
        placeholder="Your username"
        class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
      />
    {/if}
  </div>

  <div class="form-control w-full">
    <label class="label" for="bio">
      <span class="label-text">Bio</span>
    </label>
    {#if userProfile.loading || userProfile.error}
      <div class="skeleton h-32 w-full"></div>
    {:else}
      <textarea
        id="bio"
        bind:value={profileForm.bio}
        placeholder="Tell us about yourself"
        class="input input-bordered h-32 w-full focus:outline-none focus:ring-0 focus:ring-offset-0 pt-2"
      ></textarea>
    {/if}
  </div>

  <div class="flex justify-end">
    <button
      class="btn btn-primary pop hover:pop"
      onclick={updateProfile}
      disabled={isUpdatingProfile || userProfile.loading || userProfile.error}
    >
      {#if isUpdatingProfile}
        <span class="loading loading-spinner loading-sm"></span>
        Saving...
      {:else if userProfile.loading}
        <span class="loading loading-spinner loading-sm"></span>
        Loading...
      {:else}
        Save Changes
      {/if}
    </button>
  </div>
</div>
