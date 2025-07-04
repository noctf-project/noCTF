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
  import { categoryToIcon, difficultyToBgColour } from "$lib/utils/challenges";
  import { type Difficulty } from "$lib/constants/difficulties";
  import DifficultyChip from "./DifficultyChip.svelte";

  const { data, onclick }: ChallengeCardProps = $props();
</script>

<!-- class:bg-blue-500/5={!data.isSolved} -->
<button
  class={`min-w-80 text-left p-2   flex items-center gap-3 hover:bg-gray-100/50 transition-colors duration-150 ${data.isSolved ? "bg-base-300" : "bg-base-100"}`}
  onclick={() => onclick(data)}
>
  <!-- Blue bar for unsolved challenges -->
  <div class="flex-shrink-0 w-1 self-stretch">
    {#if !data.isSolved}
      <div class="w-1 h-full bg-blue-500 rounded-sm"></div>
    {/if}
  </div>

  <!-- Icon / Avatar -->
  <div class="flex-shrink-0">
    <div
      class="w-10 h-10 rounded-full flex items-center justify-center bg-gray-200"
    >
      <Icon
        icon={categoryToIcon(data.categories[0] ?? "misc")}
        class="text-2xl text-gray-600"
      />
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex-1 min-w-0">
    <!-- From / Points -->
    <div class="flex justify-between items-baseline">
      <p
        class="text-sm leading-tight truncate"
        class:font-semibold={!data.isSolved}
      >
        {data.title}
      </p>
      <p class="text-xs text-gray-500 pl-2 whitespace-nowrap">
        {data.points} pts
      </p>
    </div>

    <!-- Subject -->

    <!-- Preview / Solves & Difficulty -->
    <div class="flex justify-between items-center text-sm text-gray-500 mt-0.5">
      <p class="truncate pr-2">
        {data.solves}
        {data.solves === 1 ? "solve" : "solves"}
      </p>
      <div class="flex items-center gap-2 flex-shrink-0">
        {#if data.difficulty}
          <DifficultyChip difficulty={data.difficulty as Difficulty} />
        {/if}
        {#if data.isSolved}
          <Icon
            icon="material-symbols:check-circle-outline"
            class="text-lg text-green-600"
          />
        {/if}
      </div>
    </div>
  </div>
</button>
