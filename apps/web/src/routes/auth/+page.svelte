<script lang="ts">
  import { toasts } from "$lib/stores/toast";
  import Icon from "@iconify/svelte";
  import loginState from "./auth.svelte";
  import { header } from "./+layout.svelte";

  let isLoading = $state(false);

  // TODO: get supported OAuth providers from the API
  const oAuthProviders: { name: string; icon: string }[] = [
    // { name: "Google", icon: "mdi:google" },
    // { name: "GitHub", icon: "mdi:github" },
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
    toasts.info(
      `Social login with ${provider} is not implemented yet. Please use email login.`,
    );
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    handleEmailCheck();
  }
</script>

{@render header("Welcome", "Sign in or create an account")}

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
      bind:value={loginState.email}
      required
      autocomplete="email"
    />
  </div>

  <button
    class="btn btn-primary w-full mt-6 pop hover:pop"
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

{#if oAuthProviders.length}
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
