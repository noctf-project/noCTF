<script module>
  import { type ChallengeCardData } from "./ChallengeCard.svelte";

  export interface ChallDetails {
    description: string;
    files: string[];
  }
  export interface ChallengeModalProps {
    challData?: ChallengeCardData;
    challDetails?: ChallDetails;
    visible: boolean;
    loading: boolean;
    onClose: () => void;
  }
</script>

<script lang="ts">
  import { Carta, Markdown } from "carta-md";
  import { categoryToIcon, difficultyToBgColour } from "$lib/utils/challenges";
  import Icon from "@iconify/svelte";
  import { type Difficulty } from "$lib/constants/difficulties";
  import { fade, fly } from "svelte/transition";
  import { onMount } from "svelte";
  import { API_BASE_URL } from "$lib/api/index.svelte";

  let {
    challData,
    challDetails,
    visible,
    loading,
    onClose,
  }: ChallengeModalProps = $props();

  let flagInput = $state("");
  let scoreModalVisible = $state(false);
  let scoreModalRef: HTMLElement | undefined = $state();

  let knowsSolvesClick = localStorage.getItem("knowsSolvesClick") == "1";
  let showHint = $state(!knowsSolvesClick);
  setTimeout(() => {
    showHint = false;
  }, 2500);

  const carta = new Carta({
    sanitizer: false,
  });

  function submitFlag() {
    alert(`Flag submitted: ${flagInput}`);
  }

  function performClose() {
    scoreModalVisible = false;
    onClose();
  }

  function outsideClickHandler(node: Node) {
    const handleClick = (event: Event) => {
      if (
        node &&
        !node.contains(event.target as Node) &&
        !scoreModalRef?.contains(event.target as Node) &&
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
    class="fixed inset-0 bg-black bg-opacity-40 flex -mt-32 items-center justify-center p-4 z-50"
  >
    <div
      class="flex flex-col md:flex-row lg:flex-row gap-4 w-full lg:max-w-[50%]"
      in:fly={{ y: 25, duration: 150, delay: 100 }}
      out:fade={{ duration: 100 }}
    >
      {/* @ts-expect-error use directive incorrect typing */ null}
      <div
        class="bg-base-200 rounded-lg pop w-full p-6"
        use:outsideClickHandler
      >
        <div class="mb-6 w-full">
          <div class="flex flex-row justify-between mb-4">
            <h2 class="text-2xl font-bold">{challData?.title}</h2>
            <div class="flex flex-row gap-2">
              <div class="flex flex-row items-center gap-1 font-bold text-xl">
                <Icon
                  icon="material-symbols:stars-outline-rounded"
                  class="text-3xl"
                />
                {challData?.points}
              </div>
              <div class="relative">
                {#if showHint}
                  <div
                    transition:fade
                    class="tooltip absolute -top-2 left-8 before:!opacity-100 after:!opacity-100"
                    data-tip="Click to show solvers"
                  ></div>
                {/if}
                <button
                  class="tooltip flex flex-row items-center gap-1 font-bold text-xl hover:text-primary hover:cursor-pointer"
                  data-tip={scoreModalVisible ? "Hide solvers" : "Show solvers"}
                  onclick={() => {
                    if (!knowsSolvesClick) {
                      localStorage.setItem("knowsSolvesClick", "1");
                    }
                    scoreModalVisible = !scoreModalVisible;
                  }}
                >
                  <Icon icon="material-symbols:flag" class="text-3xl" />
                  {challData?.solves}
                </button>
              </div>
            </div>
          </div>

          <div class="flex flex-row items-center gap-3 w-full">
            {#if challData?.difficulty}
              <div
                class={`badge badge-sm rounded-xl text-xs font-black pop ${difficultyToBgColour(challData?.difficulty as Difficulty)}`}
              >
                {challData?.difficulty}
              </div>
            {/if}
            <div class="bg-neutral-400 w-full h-[1px]"></div>
            <div
              class="self-center flex flex-row gap-1 text-2xl text-neutral-400"
            >
              {#each challData!.categories! as cat}
                <div class="tooltip" data-tip={cat}>
                  <Icon icon={categoryToIcon(cat)} />
                </div>
              {/each}
            </div>
          </div>

          {#if loading}
            <div class="flex flex-col items-center gap-4 my-16">
              <div
                class="loading loading-spinner loading-lg text-primary"
              ></div>
              <p class="text-center">Loading challenge details...</p>
            </div>
          {:else}
            <div class="max-h-[48vh] overflow-auto w-full">
              <Markdown {carta} value={challDetails!.description} />
            </div>

            {#if challDetails!.files.length > 0}
              <div>
                <ul class="flex flex-row gap-4">
                  {#each challDetails!.files as file}
                    <li>
                      <a href="{API_BASE_URL}/challenges/{challData?.id}/files/{file}" class="link text-primary font-semibold"
                        >{file}</a
                      >
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
          {/if}
        </div>

        <div class="flex gap-2">
          <input
            bind:value={flagInput}
            type="text"
            placeholder={"noCTF{...}"}
            class="input input-bordered flex-grow pop !bg-base-100"
          />
          <button onclick={submitFlag} class="btn pop btn-primary"
            >Submit</button
          >
        </div>
        <!-- <div class="flex gap-2"> -->
        <!--     <input -->
        <!--     bind:value={flagInput} -->
        <!--     type="text" -->
        <!--     placeholder={"You've solved this challenge!"} -->
        <!--     class="input input-bordered flex-grow !bg-base-100" -->
        <!--     disabled -->
        <!--     /> -->
        <!--     <button on:click={submitFlag} class="btn btn-primary btn-disabled">Submit</button> -->
        <!-- </div> -->
      </div>
      {#if scoreModalVisible}
        <div
          class="bg-base-200 rounded-lg pop w-full md:w-[32rem] p-6 h-full"
          bind:this={scoreModalRef}
        >
          scores go here
        </div>
      {/if}
    </div>
  </div>
{/if}
