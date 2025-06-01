<script>
  import configState from "$lib/state/config.svelte";
</script>

<div class="h-80 flex justify-center items-end">
  <div class="center text-8xl font-mono font-extrabold">
    Welcome to {configState.siteConfig?.name || "noCTF"}
  </div>
</div>
