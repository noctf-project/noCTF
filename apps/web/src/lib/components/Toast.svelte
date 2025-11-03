<script lang="ts">
  import { toasts } from "$lib/stores/toast";
  import { fly } from "svelte/transition";
  import Icon from "@iconify/svelte";
  import { quintOut } from "svelte/easing";

  const toastStyles = {
    success: {
      icon: "material-symbols:check-circle-outline-rounded",
      class: "alert-success",
    },
    error: {
      icon: "material-symbols:error-outline-rounded",
      class: "alert-error",
    },
    warning: {
      icon: "material-symbols:warning-outline-rounded",
      class: "alert-warning",
    },
    info: {
      icon: "material-symbols:information-outline-rounded",
      class: "alert-info",
    },
  };

  const defaultStyle = toastStyles.info;
</script>

{#if $toasts.length > 0}
  <div class="toast toast-bottom toast-center p-4 z-50 w-full max-w-xs">
    {#each $toasts as toast (toast.id)}
      {@const style = toastStyles[toast.type] || defaultStyle}
      <div
        role="alert"
        transition:fly={{ duration: 350, x: 100, easing: quintOut }}
        class="alert {style.class} shadow-lg flex items-center w-full max-w-xs sm:max-w-sm mt-2"
      >
        <Icon icon={style.icon} class="text-xl sm:text-2xl flex-shrink-0 mt-px" />

        <p
          class=" flex-1 whitespace-normal text-sm sm:text-base break-words mr-2 min-w-0"
        >
          {toast.message}
        </p>

        <button
          aria-label="Close"
          class="btn btn-xs btn-ghost btn-circle flex-shrink-0"
          onclick={() => toasts.remove(toast.id)}
        >
          <Icon
            icon="material-symbols:close-rounded"
            class="text-lg sm:text-xl"
          />
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast > :global(div.alert) {
    width: 100%;
  }
</style>
