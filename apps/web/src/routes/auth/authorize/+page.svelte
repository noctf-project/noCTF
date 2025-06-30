<script lang="ts">
  import Icon from "@iconify/svelte";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { toasts } from "$lib/stores/toast";
  import { header } from "../+layout.svelte";
  import authState from "$lib/state/auth.svelte";
  import api from "$lib/api/index.svelte";
  import { SanitizedRedirect } from "$lib/utils/redirect";

  let isLoading = $state(true);

  let urlParams = new URLSearchParams(window.location.search);
  let redirectUri = urlParams.get("redirect_uri");
  let clientId = urlParams.get("client_id");
  let scopes = urlParams.get("scope");
  let stateParam = urlParams.get("state");
  let responseType = urlParams.get("response_type");

  async function handleAuthorize() {
    try {
      isLoading = true;
      const res = await api.POST("/auth/oauth/authorize_internal", {
        body: {
          redirect_uri: redirectUri ?? "",
          client_id: clientId ?? "",
          scope: scopes?.split(" ") ?? [],
          state: stateParam ?? "",
          response_type: responseType?.split(" ") ?? [],
        },
      });

      if (res.error) {
        toasts.error(
          "An error occurred during authorization: " + res.error.message,
        );
        console.error(res.error);
        isLoading = false;
        return;
      }
      SanitizedRedirect(res.data.data.url);
    } catch (error) {
      toasts.error("An error occurred during authorization");
      console.error(error);
      isLoading = false;
    }
  }

  async function handleDeny() {
    try {
      isLoading = true;
      toasts.info("Authorization denied");
      goto("/");
    } catch (error) {
      toasts.error("An error occurred");
      console.error(error);
    } finally {
      isLoading = false;
    }
  }

  onMount(async () => {
    // TODO: Fetch app details and requested scopes from the server
    // This is a placeholder for demonstration
    isLoading = false;
    if (!authState.isAuthenticated) {
      goto(
        `/auth?redirect_uri=${encodeURIComponent(location.href.slice(location.origin.length))}`,
      );
      return;
    }

    if (!redirectUri) {
      toasts.error("No redirect URI provided");
      goto("/");
      return;
    }

    if (!clientId) {
      toasts.error("No client ID provided");
      goto("/");
      return;
    }

    if (!scopes) {
      toasts.error("No scopes provided");
      goto("/");
      return;
    }

    if (!stateParam) {
      toasts.error("No state provided");
      goto("/");
      return;
    }

    if (!responseType) {
      toasts.error("No response type provided");
      goto("/");
      return;
    }

    isLoading = false;
    handleAuthorize();
  });
</script>

<!-- TODO: Get app name from server -->
{@render header(`${clientId}`, " would like to sign in to your noCTF account")}

<div class="card bg-base-100">
  {#if !isLoading && redirectUri}
    <div
      class="flex flex-col items-center gap-2 bg-base-200 p-4 rounded-lg mb-6"
    >
      <Icon
        icon="material-symbols:warning-outline"
        class="w-5 h-5 text-warning "
      />
      <p class="font-small text-center text-sm">
        This application is at
        <span class="font-bold">{new URL(redirectUri).host}</span> and is not hosted
        by noCTF. Continue only if you recognise this application and wish to grant
        access.
      </p>
    </div>

    <div class="space-y-4">
      <p class="font-medium text-center text-xl text-primary">
        {authState.user?.name}
      </p>
    </div>

    <div class="card-actions justify-between mt-6">
      <button class="btn btn-outline" onclick={handleDeny} disabled={isLoading}>
        Deny
      </button>
      <button
        class="btn btn-primary"
        onclick={handleAuthorize}
        disabled={isLoading}
      >
        {#if isLoading}
          <span class="loading loading-spinner loading-sm"></span>
        {:else}
          Authorize
        {/if}
      </button>
    </div>
  {/if}
  {#if isLoading}
    <div class="card bg-base-100">
      <div class="card-body">
        <p class="text-center text-lg">Authorizing...</p>
      </div>
    </div>
  {/if}
</div>
