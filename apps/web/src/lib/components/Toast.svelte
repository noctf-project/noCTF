<script lang="ts">
  import { toasts } from "$lib/stores/toast";
  import { fade } from "svelte/transition";
</script>

<div class="toast toast-center">
  {#each $toasts as toast (toast.id)}
    <div
      transition:fade={{ duration: 200 }}
      class="alert {toast.type === 'error'
        ? 'alert-error'
        : toast.type === 'success'
          ? 'alert-success'
          : toast.type === 'warning'
            ? 'alert-warning'
            : 'alert-info'}"
    >
      <span>{toast.message}</span>
    </div>
  {/each}
</div>
