<script lang="ts">
  import { onMount } from "svelte";
  
  // Get the path that wasn't found
  const currentPath = window.location.pathname;
  
  // Options for going back
  let canGoBack = $state(false);
  
  onMount(() => {
    // Check if we can go back in history
    canGoBack = window.history.length > 1;
  });
  
  function goBack() {
    window.history.back();
  }
  
  function goHome() {
    window.location.href = '/';
  }
</script>

<div class="h-full flex flex-col items-center justify-center p-4 text-center">
  <div class="card w-full max-w-md bg-base-100 shadow-solid border border-base-500">
    <div class="card-body">
      <div class="flex flex-col items-center gap-4 py-6">
        <!-- Error code in a stylized format -->
        <div class="text-8xl font-bold text-primary">404</div>
        
        <!-- Error message -->
        <h1 class="text-2xl font-bold">Page Not Found</h1>
        
        <!-- Friendly description -->
        <p class="text-gray-600 mb-4">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <!-- Show the path that wasn't found -->
        <div class="p-2 bg-base-200 rounded w-full overflow-hidden text-ellipsis">
          <code class="text-sm break-all">{currentPath}</code>
        </div>
        
        <!-- Action buttons -->
        <div class="flex flex-col sm:flex-row gap-3 mt-6 w-full">
          {#if canGoBack}
            <button class="btn btn-outline flex-1" onclick={goBack}>
              Go Back
            </button>
          {/if}
          <button class="btn btn-primary flex-1 shadow-solid" onclick={goHome}>
            Go Home
          </button>
        </div>
      </div>
    </div>
  </div>
</div> 


