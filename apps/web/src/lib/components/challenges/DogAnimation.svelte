<script lang="ts">
  import { fade } from "svelte/transition";
  import { cubicInOut } from "svelte/easing";

  export let showIncorrectAnimation: boolean = false;
  export let showCorrectAnimation: boolean = false;
</script>

{#snippet speechBubble(text: string)}
  <div class="relative">
    <div class="bg-base-200 rounded-lg p-3 shadow-lg max-w-xs">
      <p class="text-sm text-base-content">{text}</p>
    </div>
  </div>
{/snippet}

{#if showIncorrectAnimation}
  <div
    class="flex justify-end z-60 pointer-events-none overflow-visible gap-2 p-4"
    in:fade={{ duration: 1000, easing: cubicInOut }}
    out:fade={{ duration: 1000, easing: cubicInOut }}
  >
    {@render speechBubble("Email could not be sent :(")}
    <div class="relative">
      <img
        src="/images/incorrect-dog.png"
        alt="Incorrect dog"
        class="w-32 h-32 object-contain incorrect-animation"
      />
    </div>
  </div>
{/if}

{#if showCorrectAnimation}
  <div class="flex justify-end z-60 pointer-events-none overflow-visible p-4">
    {@render speechBubble("Email Actioned! ")}
    <div class="relative">
      <img
        src="/images/correct-dog.png"
        alt="Correct dog"
        class="w-32 h-32 object-contain correct-animation"
        in:fade={{ duration: 1000, easing: cubicInOut }}
      />
    </div>
  </div>
{/if}

<style lang="postcss">
  .incorrect-animation {
    animation: rotate 2s ease-in-out;
  }

  .correct-animation {
    animation: celebrate 2s ease-in-out;
  }

  @keyframes rotate {
    0% {
      transform: rotate(0deg);
    }
    10% {
      transform: rotate(-5deg);
    }
    20% {
      transform: rotate(5deg);
    }
    30% {
      transform: rotate(-3deg);
    }
    40% {
      transform: rotate(3deg);
    }
    50% {
      transform: rotate(-2deg);
    }
    60% {
      transform: rotate(2deg);
    }
    70% {
      transform: rotate(-1deg);
    }
    80% {
      transform: rotate(1deg);
    }
    90% {
      transform: rotate(-0.5deg);
    }
    100% {
      transform: rotate(0deg);
    }
  }

  @keyframes celebrate {
    0% {
      transform: rotate(0deg) scale(1);
    }
    15% {
      transform: rotate(15deg) scale(1.1);
    }
    30% {
      transform: rotate(-15deg) scale(1.2);
    }
    45% {
      transform: rotate(15deg) scale(1.1);
    }
    60% {
      transform: rotate(-10deg) scale(1.15);
    }
    75% {
      transform: rotate(10deg) scale(1.05);
    }
    90% {
      transform: rotate(-5deg) scale(1.02);
    }
    100% {
      transform: rotate(0deg) scale(1);
    }
  }
</style>
