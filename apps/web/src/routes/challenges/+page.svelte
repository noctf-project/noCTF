<script lang="ts">
  import type { ChallengeCardData } from "$lib/components/challenges/ChallengeCard.svelte";
  import ChallengeFilterer from "$lib/components/challenges/ChallengeFilterer.svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import {
    getCategoriesFromTags,
    getDifficultyFromTags,
    categoryOrdering,
  } from "$lib/utils/challenges";
  import ChallengeCard from "$lib/components/challenges/ChallengeCard.svelte";
  import ChallengeModal from "$lib/components/challenges/ChallengeModal.svelte";
  import { type ChallDetails } from "$lib/components/challenges/ChallengeInfo.svelte";
  import { onMount } from "svelte";
  import { toasts } from "$lib/stores/toast";
  import Icon from "@iconify/svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { DIFFICULTIES, type Difficulty } from "$lib/constants/difficulties";

  const CHALLENGE_DETAIL_CACHE_TIME = 1000 * 60 * 5; // 5 minutes

  let apiChallenges = $state(wrapLoadable(api.GET("/challenges")));
  let challDetailsMap: {
    [id in number]: {
      details: ChallDetails;
      lastFetch: Date;
    };
  } = {};

  const refreshChallenges = async () => {
    try {
      const r = await api.GET("/challenges");
      apiChallenges.r = r;
    } catch (e) {
      console.error("Challenge refresh failed", e);
      toasts.error("Failed to connect to the server - please try again later");
      return;
    }
  };

  onMount(() => {
    const refresh = setInterval(refreshChallenges, 20000);

    return () => {
      clearInterval(refresh);
    };
  });

  let allChallenges: ChallengeCardData[] | undefined = $derived(
    apiChallenges.r?.data
      ? apiChallenges.r?.data.data.challenges.map((c) => ({
          id: c.id,
          slug: c.slug,
          title: c.title,
          categories: getCategoriesFromTags(c.tags),
          solves: c.solve_count,
          points: c.value || 0,
          isSolved: c.solved_by_me,
          difficulty: getDifficultyFromTags(c.tags),
          hidden: c.hidden,
        }))
      : undefined,
  );

  let challenges: ChallengeCardData[] | undefined = $state();

  let challengesByCategory = $derived.by(() => {
    if (!challenges) {
      return {};
    }

    const grouped: { [category: string]: ChallengeCardData[] } = {};

    for (const challenge of challenges) {
      const primaryCategory =
        challenge.categories.length > 0
          ? challenge.categories[0]!
          : "uncategorized";

      if (!grouped[primaryCategory]) {
        grouped[primaryCategory] = [];
      }
      grouped[primaryCategory].push(challenge);
    }

    for (const category in grouped) {
      grouped[category]!.sort(
        (a, b) =>
          (a.points || 0) - (b.points || 0) ||
          (a.solves || 0) - (b.solves || 0) ||
          (DIFFICULTIES.indexOf(a.difficulty as Difficulty) || 0) -
            (DIFFICULTIES.indexOf(b.difficulty as Difficulty) || 0),
      );
    }

    const sortedCategories = Object.keys(grouped).sort(categoryOrdering);
    const sortedGrouped: { [category: string]: ChallengeCardData[] } = {};
    for (const category of sortedCategories) {
      sortedGrouped[category] = grouped[category] || [];
    }

    return sortedGrouped;
  });

  let modalVisible = $state(false);
  let modalLoading = $state(false);
  let modalChallData: ChallengeCardData | undefined = $state();
  let modalChallDetails: ChallDetails | undefined = $state();
  let loadedFromURLParam = $state(false);

  async function updateQueryParam(key: string, value: string) {
    const url = new URL(page.url);
    url.searchParams.set(key, value);
    goto(url.toString(), { replaceState: true });
  }

  $effect(() => {
    if (!loadedFromURLParam && allChallenges) {
      loadedFromURLParam = true;
      const slugFromURL = page.url.searchParams.get("c");
      if (slugFromURL) {
        const challData = allChallenges.find((c) => c.slug === slugFromURL);
        if (challData) {
          onChallengeClicked(challData);
        }
      }
    }
  });

  async function onChallengeClicked(challData: ChallengeCardData) {
    modalVisible = true;
    modalChallData = challData;
    modalChallDetails = undefined;
    updateQueryParam("c", challData.slug);
    const cached = challDetailsMap[challData.id];
    if (
      cached &&
      cached.lastFetch &&
      cached.lastFetch > new Date(Date.now() - CHALLENGE_DETAIL_CACHE_TIME)
    ) {
      modalChallDetails = cached.details;
    } else {
      modalLoading = true;
      try {
        const r = await api.GET("/challenges/{id}", {
          params: { path: { id: challData.id } },
        });
        if (r.data) {
          const challDetails: ChallDetails = {
            description: r.data.data.description,
            files: r.data.data.metadata.files,
          };
          challDetailsMap[challData.id] = {
            details: challDetails,
            lastFetch: new Date(),
          };
          // Only update if the modal is still meant for this challenge
          if (modalChallData?.id === challData.id) {
            modalChallDetails = challDetails;
          }
        } else if (r.error) {
          console.error("Failed to load challenge details:", r.error);
          if (modalChallData?.id === challData.id) {
            toasts.error(`Failed to load details for ${challData.title}`);
            modalVisible = false;
          }
        }
      } catch (e) {
        console.error("Failed to load challenge details:", e);
        if (modalChallData?.id === challData.id) {
          toasts.error(`Failed to load details for ${challData.title}`);
          modalVisible = false;
        }
      } finally {
        // Ensure loading is turned off if modal is still for this challenge
        if (modalChallData?.id === challData.id) {
          modalLoading = false;
        }
      }
    }
  }

  function closeModal() {
    modalVisible = false;
    const url = new URL(page.url);
    url.searchParams.delete("c");
    goto(url.toString(), { replaceState: true });
  }
</script>

<div class="w-full mx-auto px-4 sm:px-6 lg:px-8 h-auto mt-8">
  <div class="text-center text-4xl font-black pb-4">Challenges</div>

  {#if apiChallenges.loading}
    <div class="flex flex-col items-center gap-4 mt-16">
      <div class="loading loading-spinner loading-lg text-primary"></div>
      <p class="text-center">Loading challenges...</p>
    </div>
  {:else if apiChallenges.error || apiChallenges.r?.error}
    <div class="flex flex-row justify-center w-full items-center gap-4 mt-16">
      <Icon icon="material-symbols:error-outline" class="text-3xl" />
      <p class="text-center text-2xl font-bold">
        {apiChallenges.r?.error?.message || "Unknown error occurred"}
      </p>
    </div>
  {:else}
    <div
      class="flex flex-col md:grid grid-cols-[min(25%,20rem)_1fr] gap-6 lg:gap-8 py-8"
    >
      <div class="md:sticky top-8 self-start mb-6 md:mb-0 md:mt-8">
        <ChallengeFilterer
          challenges={allChallenges || []}
          onFilter={(res) => (challenges = res)}
        />
      </div>

      <div class="flex flex-wrap gap-6 h-fit">
        {#if challenges !== undefined && Object.keys(challengesByCategory).length > 0}
          {#each Object.entries(challengesByCategory) as [category, categoryChallenges] (category)}
            <div class="flex flex-col gap-2">
              <h1
                class="text-2xl text-center w-full md:text-left p-3 rounded font-bold top-0 py-2 z-10"
              >
                {category}
              </h1>
              <div
                class="flex flex-wrap md:justify-start justify-center pt-2 gap-4 min-w-[150px]"
              >
                {#each categoryChallenges as challenge (challenge.id)}
                  <ChallengeCard
                    data={challenge}
                    onclick={onChallengeClicked}
                  />
                {/each}
              </div>
            </div>
          {/each}
        {:else if challenges !== undefined && challenges.length === 0}
          <p class="w-full text-center text-neutral-500 py-10">
            No challenges match the current filters.
          </p>
        {:else if challenges === undefined && !apiChallenges.loading}
          <p class="w-full text-center text-neutral-500 py-10">
            Waiting for challenges...
          </p>
        {/if}
      </div>
    </div>

    <ChallengeModal
      visible={modalVisible}
      loading={modalLoading}
      challData={modalChallData}
      challDetails={modalChallDetails}
      onClose={closeModal}
      onSolve={() => setTimeout(refreshChallenges, 2000)}
    />
  {/if}
</div>
