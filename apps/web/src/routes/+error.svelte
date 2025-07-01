<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  const currentPath = window.location.pathname;

  let canGoBack = $state(false);

  onMount(() => {
    canGoBack = window.history.length > 1;
  });

  function goBack() {
    window.history.back();
  }

  function goHome() {
    goto("/");
  }
</script>

<div class="h-full flex flex-col items-center justify-center p-4 text-center">
  <div
    class="card w-full max-w-md bg-base-100 shadow-solid border border-base-500"
  >
    <div class="card-body">
      <div class="flex flex-col items-center gap-4 py-6">
        <div class="text-8xl font-bold text-primary">404</div>

        <h1 class="text-2xl font-bold">Page Not Found</h1>

        <p class="text-gray-600 mb-4">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div
          class="p-2 bg-base-200 rounded w-full overflow-hidden text-ellipsis"
        >
          <code class="text-sm break-all">{currentPath}</code>
        </div>

        <div class="flex flex-col sm:flex-row gap-3 mt-6 w-full">
          {#if canGoBack}
            <button
              class="btn btn-outline flex-1 pop hover:pop"
              onclick={goBack}
            >
              Go Back
            </button>
          {/if}
          <button class="btn btn-primary flex-1 pop hover:pop" onclick={goHome}>
            Go Home
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
