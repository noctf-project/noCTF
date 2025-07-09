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
  import api from "$lib/api/index.svelte";
  import { getRelativeTime } from "$lib/utils/time";
  import TeamNamesService from "$lib/state/team_query.svelte";
  import Icon from "@iconify/svelte";

  interface ScoreEntry {
    teamId: number;
    time: Date;
  }

  let scoreModalVisible = $state(false);
  let scoresLoading = $state(false);
  let scoresData: ScoreEntry[] | undefined = $state();
  let scoreModalRef: HTMLElement | undefined = $state();

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

  async function onToggleSolves() {
    scoreModalVisible = !scoreModalVisible;
    if (scoreModalVisible && !scoresLoading && !scoresData && challData) {
      scoresLoading = true;
      const r = await api.GET("/challenges/{id}/solves", {
        params: { path: { id: challData.id } },
      });
      scoresLoading = false;
      if (r.data) {
        scoresData = r.data.data.map(({ team_id, created_at }) => ({
          teamId: team_id,
          time: new Date(created_at),
        }));
      }
    }
  }

  // Reset scores when modal closes or challenge changes
  $effect(() => {
    if (!visible || !challData) {
      scoreModalVisible = false;
      scoresData = undefined;
    }
  });

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
      class="flex flex-col md:flex-row gap-4 w-full justify-center max-w-6xl"
      in:fly={{ y: 25, duration: 150, delay: 100 }}
      out:fade={{ duration: 100 }}
    >
      <!-- Main Challenge Content -->
      {/* @ts-expect-error use directive incorrect typing */ null}
      <div
        class="bg-base-200 rounded-lg pop w-full h-fit flex-1"
        use:outsideClickHandler
      >
        <ChallengeInfo
          {challData}
          {challDetails}
          {loading}
          {onSolve}
          {onToggleSolves}
          hideScores={true}
        />
      </div>

      <!-- Solves Panel - Desktop: beside, Mobile: underneath -->
      {#if scoreModalVisible}
        <div
          class="bg-base-100 rounded-lg pop w-full md:w-80 md:flex-shrink-0 max-h-[30rem] overflow-hidden flex flex-col"
          bind:this={scoreModalRef}
        >
          <div class="p-4 border-b border-base-200">
            <h2 class="text-center text-xl font-semibold">Solves</h2>
          </div>
          <div class="flex-1 overflow-y-auto p-4">
            {#if scoresLoading}
              <div class="flex flex-col items-center gap-4">
                <div
                  class="loading loading-spinner loading-lg text-primary"
                ></div>
                <p class="text-center">Loading solves...</p>
              </div>
            {:else if scoresData?.length == 0}
              <div class="text-center">No solves yet, be the first!</div>
            {:else}
              <table class="table table-fixed table-bordered w-full">
                <thead>
                  <tr>
                    <th class="border-base-400 border-b w-8">#</th>
                    <th class="border-base-400 border-b w-full">Team</th>
                    <th class="border-base-400 border-b whitespace-nowrap w-20"
                      >Solved</th
                    >
                  </tr>
                </thead>
                <tbody>
                  {#each scoresData! as { teamId, time }, index}
                    <tr class="border-base-300 border-b">
                      <td class="font-medium text-left">
                        {#if index <= 2}
                          {["🥇", "🥈", "🥉"][index]}
                        {:else}
                          {index + 1}
                        {/if}
                      </td>
                      <td class="font-medium text-primary max-w-0">
                        {#await TeamNamesService.get(teamId)}
                          <div class="skeleton w-full h-4"></div>
                        {:then team}
                          <a
                            href="/teams/{teamId}"
                            title={team?.name}
                            class="block truncate hover:text-primary-focus"
                          >
                            {team?.name}
                          </a>
                        {/await}
                      </td>
                      <td
                        class="text-neutral-400 whitespace-nowrap tooltip tooltip-left"
                        data-tip={`${time.toLocaleDateString()} ${time.toLocaleTimeString()}`}
                      >
                        {getRelativeTime(time)}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
