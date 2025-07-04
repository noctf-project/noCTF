<script module lang="ts">
  import { type ChallengeCardData } from "./ChallengeCard.svelte";

  export interface ChallengeModalProps {
    challData?: ChallengeCardData;
    challDetails?: ChallDetails;
    visible: boolean;
    loading: boolean;
    onClose: () => void;
    onSolve: () => void;
  }
</script>

<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { onMount } from "svelte";
  import ChallengeInfo, { type ChallDetails } from "./ChallengeInfo.svelte";

  let {
    challData,
    challDetails,
    visible,
    loading,
    onClose,
    onSolve,
  }: ChallengeModalProps = $props();

  function performClose() {
    onClose();
  }

  function outsideClickHandler(node: Node) {
    const handleClick = (event: Event) => {
      if (
        node &&
        !node.contains(event.target as Node) &&
        !event.defaultPrevented
      ) {
        performClose();
        document.removeEventListener("click", handleClick, true);
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }

  function keyDownHandler(event: KeyboardEvent) {
    if (event.key === "Escape") {
      performClose();
    }
  }

  onMount(() => {
    document.addEventListener("keydown", keyDownHandler);
    return () => {
      document.removeEventListener("keydown", keyDownHandler);
    };
  });
</script>

{#if visible}
  <div
    in:fade={{ duration: 100 }}
    out:fade={{ duration: 100 }}
    class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50"
  >
    <div
      class="flex flex-col md:flex-row lg:flex-row gap-4 w-full justify-center"
      in:fly={{ y: 25, duration: 150, delay: 100 }}
      out:fade={{ duration: 100 }}
    >
      {/* @ts-expect-error use directive incorrect typing */ null}
      <div
        class="bg-base-200 rounded-lg pop w-full h-fit w-ful lg:max-w-[50%]"
        use:outsideClickHandler
      >
        <ChallengeInfo {challData} {challDetails} {loading} {onSolve} />
      </div>
    </div>
  </div>
{/if}
