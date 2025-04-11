<script lang="ts">
  import type { ChallengeCardData } from "$lib/components/challenges/ChallengeCard.svelte";
  import ChallengeFilterer from "$lib/components/challenges/ChallengeFilterer.svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import {
    getCategoriesFromTags,
    getDifficultyFromTags,
  } from "$lib/utils/challenges";
  import ChallengeCard from "$lib/components/challenges/ChallengeCard.svelte";
  import ChallengeModal, {
    type ChallDetails,
  } from "$lib/components/challenges/ChallengeModal.svelte";
  import { onMount } from "svelte";
  import { toasts } from "$lib/stores/toast";

  let apiChallenges = wrapLoadable(api.GET("/challenges"));
  let challDetailsMap: { [id in number]: ChallDetails } = {};

  const refreshChallenges = async () => {
    try {
      const r = await api.GET("/challenges");
      apiChallenges.r = r;
    } catch (e) {
      console.error("Challenge refresh failed", e);
      toasts.error("Failed to connect to the server - please try again");
      return;
    }
  };

  onMount(() => {
    const refresh = setInterval(
      refreshChallenges,
      20000 + Math.floor(Math.random() * 10000),
    );

    return () => {
      clearInterval(refresh);
    };
  });

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

  let modalVisible = $state(false);
  let modalLoading = $state(false);
  let modalChallData: ChallengeCardData | undefined = $state();
  let modalChallDetails: ChallDetails | undefined = $state();

  async function onChallengeClicked(challData: ChallengeCardData) {
    modalVisible = true;
    modalChallData = challData;
    modalChallDetails = undefined; // Reset details while loading/fetching
    if (challDetailsMap[challData.id]) {
      modalChallDetails = challDetailsMap[challData.id];
    } else {
      modalLoading = true;
      try {
        // Add try-catch for the specific challenge fetch
        const r = await api.GET("/challenges/{id}", {
          params: { path: { id: challData.id } },
        });
        if (r.data) {
          const challDetails: ChallDetails = {
            description: r.data.data.description,
            // Ensure metadata and files exist before mapping
            files: r.data.data.metadata?.files?.map((f) => f.name) ?? [],
          };
          challDetailsMap[challData.id] = challDetails;
          // Only update if the modal is still meant for this challenge
          if (modalChallData?.id === challData.id) {
            modalChallDetails = challDetails;
          }
        } else if (r.error) {
          // Handle API error for specific challenge
          console.error("Failed to load challenge details:", r.error);
          if (modalChallData?.id === challData.id) {
            // Optionally show error in modal or use a toast
            toasts.error(`Failed to load details for ${challData.title}`);
            modalVisible = false; // Close modal on error, or handle differently
          }
        }
      } catch (e) {
        console.error("Failed to load challenge details:", e);
        if (modalChallData?.id === challData.id) {
          toasts.error(`Failed to load details for ${challData.title}`);
          modalVisible = false; // Close modal on error
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
    // Optional: clear modal data when closing to prevent stale data flash
    // modalChallData = undefined;
    // modalChallDetails = undefined;
  }
</script>

<div class="w-full mx-auto px-4 sm:px-6 lg:px-8 h-auto mt-8">
  <div class="text-center text-4xl font-black pb-4">Challenges</div>

  {#if apiChallenges.loading}
    <div class="flex flex-col items-center gap-4 mt-16">
      <div class="loading loading-spinner loading-lg text-primary"></div>
      <p class="text-center">Loading challenges...</p>
    </div>
  {:else if apiChallenges.r.error}
    <div class="flex flex-col items-center gap-4 mt-16">
      <p class="text-center">{apiChallenges.r.error.message}</p>
      <button class="btn btn-primary" onclick={refreshChallenges}>
        Retry
      </button>
    </div>
  {:else}
    <div
      class="flex flex-col md:grid grid-cols-[min(25%,20rem)_1fr] gap-6 lg:gap-8 py-8"
    >
      <div class="sticky top-8 self-start mb-6 md:mb-0 md:mt-8">
        <ChallengeFilterer
          challenges={allChallenges || []}
          onFilter={(res) => (challenges = res)}
        />
      </div>

      <div
        class="flex flex-row flex-wrap gap-4 justify-center md:justify-start content-start"
      >
        {#if challenges && challenges.length > 0}
          {#each challenges as challenge (challenge.id)}
            <ChallengeCard data={challenge} onclick={onChallengeClicked} />
          {/each}
        {:else if allChallenges && challenges && challenges.length === 0}
          <p class="w-full text-center text-neutral-500">
            No challenges match the current filters.
          </p>
        {:else if !allChallenges}
          <p class="w-full text-center text-neutral-500">
            Challenges loaded incorrectly.
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
      onSolve={async () => {
        await refreshChallenges();
        closeModal();
      }}
    />
  {/if}
</div>
