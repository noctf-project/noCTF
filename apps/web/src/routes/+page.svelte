<script>
  import { Carta, Markdown } from "carta-md";
  import DOMPurify from "isomorphic-dompurify";
  import configState from "$lib/state/config.svelte";
  import "carta-md/default.css";

  const carta = new Carta({
    sanitizer: DOMPurify.sanitize,
  });
</script>

<div
  class="min-h-80 flex flex-col justify-center items-center gap-8 px-6 py-12"
>
  <h1
    class="text-center text-4xl sm:text-6xl lg:text-8xl font-mono font-extrabold"
  >
    Welcome to {configState.siteConfig?.name || "noCTF"}
  </h1>
  {#if configState.siteConfig?.message}
    <div class="prose markdown-body homepage-message w-full max-w-4xl mx-auto">
      <Markdown {carta} value={configState.siteConfig.message} />
    </div>
  {/if}
</div>
