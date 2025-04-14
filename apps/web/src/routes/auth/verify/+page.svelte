<script lang="ts">
  import Icon from "@iconify/svelte";
  import loginState from "../auth.svelte";
  import { goto } from "$app/navigation";
  import { header } from "../+layout.svelte";
  import { onMount } from "svelte";

  let isLoading = $state(false);

  loginState.currentStage = "verification-required";

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
    } finally {
      isLoading = false;
    }
  }
</script>

{#if loginState.currentStage === "verification-required"}
  {@render header("Verify your email", "Send a verification link")}
{:else if loginState.currentStage === "verification-sent"}
  {@render header("Check your email", "We've sent a verifcation link")}
{/if}

{#if loginState.currentStage === "verification-required"}
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
    <button class="btn btn-primary w-full" onclick={handleVerifyRequired}>
      Verify My Email
    </button>
    <button class="btn btn-outline w-full" onclick={loginState.goBack}>
      Use a different email
    </button>
  </div>
{/if}

{#if loginState.currentStage === "verification-sent"}
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

    <button class="btn btn-outline w-full" onclick={loginState.goBack}>
      Use a different email
    </button>
  </div>
{/if}
