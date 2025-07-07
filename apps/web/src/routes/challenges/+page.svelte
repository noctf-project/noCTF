<script lang="ts">
  import type { ChallengeCardData } from "$lib/components/challenges/ChallengeCard.svelte";
  import ChallengeFilterer from "$lib/components/challenges/ChallengeFilterer.svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import {
    getCategoriesFromTags,
    getDifficultyFromTags,
  } from "$lib/utils/challenges";
  import ChallengeCard from "$lib/components/challenges/ChallengeCard.svelte";
  import ChallengeModal from "$lib/components/challenges/ChallengeModal.svelte";
  import { type ChallDetails } from "$lib/components/challenges/ChallengeInfo.svelte";
  import { onMount } from "svelte";
  import { toasts } from "$lib/stores/toast";
  import Icon from "@iconify/svelte";
  import ChallengeInfo from "$lib/components/challenges/ChallengeInfo.svelte";

  let apiChallenges = $state(wrapLoadable(api.GET("/challenges")));
  let challDetailsMap: { [id in number]: ChallDetails } = {};

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
    const stored = localStorage.getItem("isEmailView");
    if (stored !== null) {
      isEmailView = stored === "true";
    }

    return () => {
      clearInterval(refresh);
    };
  });

  // Watch for when challenges become available and select the first one in email view
  $effect(() => {
    if (isEmailView && challenges && challenges.length > 0 && !modalChallData) {
      const firstChallenge = challenges[0];
      if (firstChallenge) {
        onChallengeClicked(firstChallenge);
      }
    }
  });

  let allChallenges: ChallengeCardData[] | undefined = $derived(
    apiChallenges.r?.data
      ? apiChallenges.r?.data.data.challenges.map((c) => ({
          id: c.id,
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
      const categories =
        challenge.categories.length > 0
          ? challenge.categories
          : ["uncategorized"];

      for (const category of categories) {
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push(challenge);
      }
    }

    for (const category in grouped) {
      grouped[category]!.sort((a, b) => (a.points || 0) - (b.points || 0));
    }

    const sortedCategories = Object.keys(grouped).sort();
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
  let isEmailView = $state(true);
  let collapsedCategories = $state<Record<string, boolean>>({});

  async function onChallengeClicked(challData: ChallengeCardData) {
    modalVisible = true;
    modalChallData = challData;
    modalChallDetails = undefined; // Reset details while loading/fetching
    if (challDetailsMap[challData.id]) {
      modalChallDetails = challDetailsMap[challData.id];
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
          challDetailsMap[challData.id] = challDetails;
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
  }
</script>

<div class="w-full mx-auto px-4 sm:px-6 lg:px-8 h-auto mt-8">
  <!-- <div class="text-center text-4xl font-black pb-4">Inbox</div> -->
  <div class="flex justify-center mb-6">
    <button
      class="btn btn-outline btn-sm gap-2"
      onclick={() => {
        isEmailView = !isEmailView;
        modalChallData = undefined;
        modalVisible = false;
        localStorage.setItem("isEmailView", String(isEmailView));
      }}
    >
      <Icon
        icon={isEmailView
          ? "material-symbols:background-dot-small"
          : "material-symbols:mail"}
      />
      {isEmailView ? "Grid View" : "Inbox View"}
    </button>
  </div>
  {#if apiChallenges.loading}
    <div class="flex flex-col items-center gap-4 mt-16">
      <div class="loading loading-spinner loading-lg text-primary"></div>
      <p class="text-center">Loading challenges...</p>
    </div>
  {:else if apiChallenges.error || apiChallenges.r?.error}
    <div class="flex flex-col items-center gap-4 mt-16">
      <p class="text-center">
        {apiChallenges.r?.error?.message || "Unknown error occurred"}
      </p>
      <button
        class="btn btn-primary"
        onclick={() => {
          // Refresh challenges does not reset the loading state
          // so we need to reset it manually
          apiChallenges = wrapLoadable(api.GET("/challenges"));
        }}
      >
        Retry
      </button>
    </div>
  {:else}
    <div
      class="flex min-h-screen flex-col p-2 rounded md:grid grid-cols-[min(25%,20rem)_1fr] gap-6 lg:gap-8 bg-base-300"
      style="min-height: calc(100vh - 24rem);"
    >
      <div class="md:sticky top-8 self-start mb-6 md:mb-0">
        <ChallengeFilterer
          challenges={allChallenges || []}
          onFilter={(res) => (challenges = res)}
        />
      </div>

      <div class="flex flex-wrap gap-6 h-fit">
        {#if challenges !== undefined && Object.keys(challengesByCategory).length > 0}
          <!-- Email View -->
          {#if isEmailView}
            <div class="flex w-full gap-5">
              <div class="flex flex-col shadow-md border-base-400 rounded-md">
                <div class="py-2 px-3 bg-base-100 rounded-t-md">
                  <h2 class="text-xl font-bold">Inbox</h2>
                </div>
                <div
                  class="flex flex-col overflow-y-auto no-scrollbar"
                  style="height: calc(100vh - 24rem); width: max-content; min-width: 320px;"
                >
                  {#each Object.entries(challengesByCategory) as [category, categoryChallenges] (category)}
                    <div class="rounded-lg">
                      <button
                        class="flex w-full items-center justify-between px-4 py-1 cursor-pointer select-none bg-base-300"
                        onclick={() =>
                          (collapsedCategories = {
                            ...collapsedCategories,
                            [category]: !collapsedCategories[category],
                          })}
                      >
                        <span class="font-semibold text-md">{category}</span>
                        <Icon
                          icon={collapsedCategories[category]
                            ? "mdi:chevron-right"
                            : "mdi:chevron-down"}
                          class="transition-transform duration-200"
                        />
                      </button>
                      {#if !collapsedCategories[category]}
                        <div
                          class="flex flex-col divide-y dark:divide-gray-900"
                        >
                          {#each categoryChallenges as challenge (challenge.id)}
                            <div
                              class="hover:bg-base-100 transition-colors cursor-pointer"
                            >
                              <ChallengeCard
                                data={challenge}
                                onclick={onChallengeClicked}
                              />
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
              <div class="flex-grow w-full">
                <ChallengeInfo
                  challData={modalChallData}
                  challDetails={modalChallDetails}
                  loading={modalLoading}
                  onSolve={() => setTimeout(refreshChallenges, 2000)}
                />
              </div>
            </div>
          {:else}
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
          {/if}
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
    <!-- Grid View -->
    {#if !isEmailView}
      <ChallengeModal
        visible={modalVisible}
        loading={modalLoading}
        challData={modalChallData}
        challDetails={modalChallDetails}
        onClose={closeModal}
        onSolve={() => setTimeout(refreshChallenges, 2000)}
      />
    {/if}
  {/if}
</div>

<style>
  .no-scrollbar {
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE 10+ */
  }
  .no-scrollbar::-webkit-scrollbar {
    display: none; /* Chrome/Safari/Webkit */
  }
</style>
