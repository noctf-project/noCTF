<script lang="ts">
  import Icon from "@iconify/svelte";

  const {
    totalItems = 0,
    itemsPerPage = 25,
    initialPage = 0,
    compact = false,
    className = "",
    onChange = (_page: number) => {},
  } = $props<{
    totalItems?: number;
    itemsPerPage?: number;
    initialPage?: number;
    compact?: boolean;
    className?: string;
    onChange?: (page: number) => void;
  }>();

  let currentPage = $state(initialPage);

  const totalPages = $derived(
    Math.max(1, Math.ceil(totalItems / itemsPerPage)),
  );
  const startItem = $derived(totalItems ? currentPage * itemsPerPage + 1 : 0);
  const endItem = $derived(
    Math.min((currentPage + 1) * itemsPerPage, totalItems),
  );

  function goToNextPage() {
    if (currentPage < totalPages - 1) {
      currentPage++;
      onChange(currentPage);
    }
  }

  function goToPrevPage() {
    if (currentPage > 0) {
      currentPage--;
      onChange(currentPage);
    }
  }

  function goToPage(page: number) {
    if (page >= 0 && page < totalPages) {
      currentPage = page;
      onChange(currentPage);
    }
  }

  $effect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      currentPage = totalPages - 1;
      onChange(currentPage);
    }
  });
</script>

<div class={`flex flex-col items-center gap-2 ${className}`}>
  <div class="flex flex-wrap justify-center items-center gap-2">
    <button
      class="btn btn-sm bg-base-100 pop hover:pop"
      disabled={currentPage === 0}
      onclick={goToPrevPage}
    >
      <Icon icon="material-symbols:arrow-back" />
      Previous
    </button>

    <div class="flex gap-1 mx-2">
      {#if totalPages <= 7}
        {#each Array(totalPages) as _, i}
          <button
            class="btn btn-sm hover:pop pop {i === currentPage
              ? 'btn-primary'
              : 'bg-base-100'}"
            onclick={() => goToPage(i)}
          >
            {i + 1}
          </button>
        {/each}
      {:else}
        <button
          class="btn btn-sm hover:pop pop {currentPage === 0
            ? 'btn-primary'
            : 'bg-base-100'}"
          onclick={() => goToPage(0)}
        >
          1
        </button>

        {#if currentPage > 2}
          <button class="btn btn-sm bg-base-100 hover:pop pop">...</button>
        {/if}

        {#if currentPage <= 2}
          {#each [1, 2, 3] as i}
            <button
              class="btn btn-sm hover:pop pop {i === currentPage
                ? 'btn-primary'
                : 'bg-base-100'}"
              onclick={() => goToPage(i)}
            >
              {i + 1}
            </button>
          {/each}
        {:else if currentPage >= totalPages - 3}
          {#each [totalPages - 4, totalPages - 3, totalPages - 2] as i}
            <button
              class="btn btn-sm hover:pop pop {i === currentPage
                ? 'btn-primary'
                : 'bg-base-100'}"
              onclick={() => goToPage(i)}
            >
              {i + 1}
            </button>
          {/each}
        {:else}
          {#each [currentPage - 1, currentPage, currentPage + 1] as i}
            <button
              class="btn btn-sm hover:pop pop {i === currentPage
                ? 'btn-primary'
                : 'bg-base-100'}"
              onclick={() => goToPage(i)}
            >
              {i + 1}
            </button>
          {/each}
        {/if}

        {#if currentPage < totalPages - 3}
          <button class="btn btn-sm bg-base-100 hover:pop pop">...</button>
        {/if}

        <button
          class="btn btn-sm hover:pop pop {currentPage === totalPages - 1
            ? 'btn-primary'
            : 'bg-base-100'}"
          onclick={() => goToPage(totalPages - 1)}
        >
          {totalPages}
        </button>
      {/if}
    </div>

    <button
      class="btn btn-sm bg-base-100 pop hover:pop"
      disabled={currentPage === totalPages - 1}
      onclick={goToNextPage}
    >
      Next
      <Icon icon="material-symbols:arrow-forward" />
    </button>
  </div>

  <div class="text-sm text-center text-base-content/70">
    {#if compact}
      Page {currentPage + 1} of {totalPages} • {totalItems} items
    {:else}
      Page {currentPage + 1} of {totalPages} • Showing items {startItem}-{endItem}
      of {totalItems}
    {/if}
  </div>
</div>
