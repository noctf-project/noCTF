<script lang="ts">
  let { children } = $props();
</script>

<div class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-8">
  <div class="flex items-center gap-4 mb-8">
    <h1 class="text-4xl font-bold">Configuration</h1>
  </div>

  <div class="card bg-base-100 pop rounded-lg w-full">
    <div class="card-body">
      {@render children()}
    </div>
  </div>
</div>
