<script lang="ts">
  import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";
</script>

<div class="space-y-6">
  <h2 class="text-2xl font-bold">Preferences</h2>

  <div>
    <h3 class="text-lg font-semibold mb-4">Theme</h3>
    <div class="card bg-base-200 p-4 rounded-lg">
      <div
        class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <p class="font-medium">Colour Theme</p>
          <p class="text-sm text-base-content/70">
            Choose your preferred colour theme
          </p>
        </div>
        <button class="btn btn-primary pop hover:pop pl-1 pr-4">
          <ThemeSwitcher detailed={true} />
        </button>
      </div>
    </div>
  </div>
</div>
