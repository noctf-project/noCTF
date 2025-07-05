<script module lang="ts">
  export interface ChallengeCardData {
    id: number;
    title: string;
    categories: string[];
    solves: number;
    points: number;
    isSolved: boolean;
    difficulty?: string;
  }

  export interface ChallengeCardProps {
    data: ChallengeCardData;
    onclick: (c: ChallengeCardData) => void;
  }
</script>

<script lang="ts">
  import Icon from "@iconify/svelte";
  import { categoryToIcon } from "$lib/utils/challenges";
  import { type Difficulty } from "$lib/constants/difficulties";
  import DifficultyChip from "./DifficultyChip.svelte";

  const { data, onclick }: ChallengeCardProps = $props();
  // Cannot destructure data here, breaks reactivity https://svelte.dev/docs/svelte/$state#Deep-state
  // const { title, categories, solves, points, isSolved, difficulty } = data;
</script>

<button
  class={`text-left card w-60 h-32 pop ${data.isSolved ? "bg-primary text-primary-content" : "bg-base-100"} rounded-lg shadow-black`}
  onclick={() => onclick(data)}
>
  <div class="card-body p-3 flex flex-col">
    <div class="card-title line-clamp-1 font-black">
      {data.title}
    </div>
    <div class="flex flex-row items-center gap-3">
      {#if data.difficulty}
        <DifficultyChip difficulty={data.difficulty as Difficulty} />
      {/if}
      <div
        class={`${data.isSolved ? "bg-primary-content" : "bg-neutral-400"} w-full h-[1px]`}
      ></div>
      <div
        class={`self-center flex flex-row gap-1 text-2xl ${data.isSolved ? "text-primary-content" : "text-neutral-400"}`}
      >
        {#each data.categories as cat}
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
          {data.solves}
        </div>
        <div class="flex flex-row items-center gap-1 font-bold text-xl">
          <Icon
            icon={data.isSolved
              ? "material-symbols:check-circle-outline-rounded"
              : "material-symbols:stars-outline-rounded"}
            class="text-3xl"
          />
          {data.points}
        </div>
      </div>
    </div>
  </div>
</button>
