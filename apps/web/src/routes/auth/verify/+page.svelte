<script lang="ts">
  import Icon from "@iconify/svelte";
  import loginState from "../auth.svelte";
  import { goto } from "$app/navigation";
  import { header } from "../+layout.svelte";
  import { onMount } from "svelte";
  import { toasts } from "$lib/stores/toast";
  let isLoading = $state(false);

  let verificationSent = $state(false);

  onMount(() => {
    if (!loginState.email) {
      goto("/auth");
    }
  });

  async function handleVerifyRequired() {
    if (!loginState.email) return;
    try {
      isLoading = true;
      await loginState.verifyEmail();
      verificationSent = true;
    } catch (e) {
      console.error("Error during email verification:", e);
      toasts.error("An error occurred while verifying your email.");
    } finally {
      isLoading = false;
    }
  }
</script>

{#if !verificationSent}
  {@render header("Verify your email", "Send a verification link")}
{:else}
  {@render header("Check your email", "We've sent a verifcation link")}
{/if}

{#if !verificationSent}
  <div class="pb-4 flex flex-col items-center">
    <div class="rounded-full flex items-center justify-center pb-4">
      <Icon icon="material-symbols:mail-outline" class="text-4xl" />
    </div>

    <p class="text-center mb-4">
      We could not find an account with the email <strong
        >{loginState.email}</strong
      >. If you would like to create an account, please click the button below
      to be sent a verification email.
    </p>
  </div>

  <div class="flex flex-col gap-3">
    <button
      class="btn btn-primary pop hover:pop w-full"
      onclick={handleVerifyRequired}
    >
      Verify My Email
    </button>
    <button
      class="btn btn-outline pop hover:pop w-full"
      onclick={() => goto("/auth")}
    >
      Use a different email
    </button>
  </div>
{/if}

{#if verificationSent}
  <div class="pb-4 flex flex-col items-center">
    <div class="rounded-full flex items-center justify-center pb-4">
      <Icon icon="material-symbols:mail-outline" class="text-4xl" />
    </div>

    <p class="text-center mb-4">
      We've sent a verification link to <strong>{loginState.email}</strong>.
      Please check your inbox and click the link to complete registration.
    </p>

    <p class="text-sm text-gray-500 mb-6">
      If you don't see the email, check your spam folder.
    </p>

    <button
      class="btn btn-outline pop hover:pop w-full"
      onclick={() => goto("/auth")}
    >
      Use a different email
    </button>
  </div>
{/if}
