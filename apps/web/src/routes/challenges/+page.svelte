<script lang="ts">
  import type { ChallengeCardData } from "$lib/components/challenges/ChallengeCard.svelte";
  import ChallengeFilterer from "$lib/components/challenges/ChallengeFilterer.svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import {
    getCategoriesFromTags,
    getDifficultyFromTags,
  } from "$lib/utils/challenges";
  import ChallengeCard from "$lib/components/challenges/ChallengeCard.svelte";
  import ChallengeModal, { type ChallDetails } from "$lib/components/challenges/ChallengeModal.svelte";

  let apiChallenges = wrapLoadable(api.GET("/challenges"));
  let challDetailsMap: { [id in number]: ChallDetails } = {}

  let allChallenges: ChallengeCardData[] | undefined = $derived(
    apiChallenges.r?.data
      ? apiChallenges.r?.data.data.challenges.map((c) => ({
          id: c.id,
          title: c.title,
          categories: getCategoriesFromTags(c.tags),
          solves: c.solve_count,
          points: c.score!,
          isSolved: c.solved_by_me,
          difficulty: getDifficultyFromTags(c.tags),
        }))
      : undefined,
  );

  let challenges: ChallengeCardData[] | undefined = $state();
  $effect(() => {
    if (allChallenges) {
      challenges = allChallenges.sort((a, b) => b.solves - a.solves);
    }
  });

  let modalVisible = $state(false)
  let modalLoading = $state(false)
  let modalChallData: ChallengeCardData | undefined = $state()
  let modalChallDetails: ChallDetails | undefined = $state()

  async function onChallengeClicked(challData: ChallengeCardData) {
    modalVisible = true;
    modalChallData = challData;
    if (challDetailsMap[challData.id]) {
      modalChallDetails = challDetailsMap[challData.id];
    } else {
      modalLoading = true;
      const r = await api.GET("/challenges/{id}", { params: { path: { id: challData.id }}});
      if (r.data) {
        const challDetails: ChallDetails = {
          description: r.data.data.description,
          files: r.data.data.metadata.files.map((f) => f.name),
        };
        challDetailsMap[challData.id] = challDetails;
        modalChallDetails = challDetails;
        modalLoading = false;
      }
      // TODO: error handling
    }
  }
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
      <div class="flex flex-row flex-wrap gap-3 content-start">
        {#each challenges! as challenge (challenge.id)}
          <ChallengeCard data={challenge} onclick={onChallengeClicked} />
        {/each}
      </div>
    </div>
    <ChallengeModal challData={modalChallData} challDetails={modalChallDetails} loading={modalLoading} visible={modalVisible} onClose={() => modalVisible = false} />
  {/if}
</div>
