<script lang="ts">
  import ChallengeBoard from "$lib/components/challenges/ChallengeBoard.svelte";
  import type { ChallengeCardProps } from "$lib/components/challenges/ChallengeCard.svelte";
  import ChallengeFilterer from "$lib/components/challenges/ChallengeFilterer.svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import {
    getCategoriesFromTags,
    getDifficultyFromTags,
  } from "$lib/utils/challenges";

  let apiChallenges = wrapLoadable(api.GET("/challenges"));

  let allChallenges: ChallengeCardProps[] | undefined = $derived(
    apiChallenges.r?.data
      ? apiChallenges.r?.data.data.challenges.map((c) => ({
          title: c.title,
          categories: getCategoriesFromTags(c.tags),
          solves: c.solve_count,
          points: c.score!,
          isSolved: c.solved_by_me,
          difficulty: getDifficultyFromTags(c.tags),
        }))
      : undefined,
  );

  let challenges: ChallengeCardProps[] | undefined = $state();
  $effect(() => {
    if (allChallenges) {
      challenges = allChallenges.sort((a, b) => b.solves - a.solves);
    }
  })
</script>

<div class="w-11/12 m-auto h-auto mt-8">
  <div class="self-center text-center text-4xl font-black pb-4">Challenges</div>
  {#if apiChallenges.loading}
    <div class="flex flex-col items-center gap-4 mt-16">
        <div class="loading loading-spinner loading-lg text-primary"></div>
        <p class="text-center">Loading challenges...</p>
    </div>
  {:else}
    <div class="grid grid-cols-[min(25%,20rem)_75%] gap-4 px-16 py-8">
      <div class="mt-8">
        <ChallengeFilterer
          challenges={allChallenges!}
          onFilter={(res) => (challenges = res)}
        />
      </div>
      <ChallengeBoard challenges={challenges!} />
    </div>
  {/if}
</div>
