<script module lang="ts">
  export interface ChallengeCardProps {
    title: string;
    categories: string[];
    solves: number;
    points: number;
    isSolved: boolean;
    difficulty?: string;
  }
</script>

<script lang="ts">
  import Icon from "@iconify/svelte";
  import { categoryToIcon, difficultyToBgColour } from "$lib/utils/challenges";

  const {
    title,
    categories,
    solves,
    points,
    isSolved,
    difficulty,
  }: ChallengeCardProps = $props();
</script>

<div
  class={`card w-60 h-32 border border-base-500 shadow-solid ${isSolved ? "bg-primary text-primary-content" : "bg-base-100"} rounded-lg shadow-black`}
>
  <div class="card-body p-3 flex flex-col">
    <div class="card-title line-clamp-1 font-black">
      {title}
    </div>
    <div class="flex flex-row items-center gap-3">
      {#if difficulty}
        <div
          class={`badge badge-sm rounded-xl text-xs font-black border-base-content shadow-solid ${difficultyToBgColour(difficulty)}`}
        >
          {difficulty}
        </div>
      {/if}
      <div
        class={`${isSolved ? "bg-primary-content" : "bg-neutral-400"} w-full h-[1px]`}
      ></div>
      <div
        class={`self-center flex flex-row gap-1 text-2xl ${isSolved ? "text-primary-content" : "text-neutral-400"}`}
      >
        {#each categories as cat}
          <div class="tooltip" data-tip={cat}>
            <Icon icon={categoryToIcon(cat)} />
          </div>
        {/each}
      </div>
    </div>
    <div class="flex-grow"></div>
    <div class="flex flex-col gap-4">
      <div class="flex flex-row justify-between">
        <div class="flex flex-row items-center gap-1 font-bold text-xl">
          <Icon icon="material-symbols:flag" class="text-3xl" />
          {solves}
        </div>
        <div class="flex flex-row items-center gap-1 font-bold text-xl">
          <Icon
            icon={isSolved
              ? "material-symbols:check-circle-outline-rounded"
              : "material-symbols:stars-outline-rounded"}
            class="text-3xl"
          />
          {points}
        </div>
      </div>
    </div>
  </div>
</div>
