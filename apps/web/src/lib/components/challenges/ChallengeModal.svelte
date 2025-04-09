<script module lang="ts">
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
    onSolve: () => void;
  }

  interface ScoreEntry {
    teamId: number;
    time: Date;
  }
</script>

<script lang="ts">
  import { Carta, Markdown } from "carta-md";
  import { categoryToIcon, difficultyToBgColour } from "$lib/utils/challenges";
  import Icon from "@iconify/svelte";
  import { type Difficulty } from "$lib/constants/difficulties";
  import { Tween } from "svelte/motion";
  import { cubicInOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";
  import { onMount } from "svelte";
  import api, { API_BASE_URL } from "$lib/api/index.svelte";
  import { getRelativeTime } from "$lib/utils/time";
  import TeamNamesService from "$lib/state/team_query.svelte";
  import { toasts } from "$lib/stores/toast";

  let {
    challData,
    challDetails,
    visible,
    loading,
    onClose,
    onSolve,
  }: ChallengeModalProps = $props();

  let flagInput = $state("");
  let flagSubmitStatus: undefined | "invalid" | "incorrect" | "correct" | "queued" =
    $state();
  let scoreModalVisible = $state(false);
  let scoreModalRef: HTMLElement | undefined = $state();
  let scoresLoading = $state(false);
  let scoresData: ScoreEntry[] | undefined = $state(undefined);

  let knowsSolvesClick = localStorage.getItem("knowsSolvesClick") == "1";
  let showHint = $state(!knowsSolvesClick);
  setTimeout(() => {
    showHint = false;
  }, 2500);

  const carta = new Carta({
    sanitizer: false,
  });

  const correctAnim = new Tween(0, {
    duration: 600,
    easing: cubicInOut,
  });
  async function submitFlag() {
    if (!flagInput) {
      return;
    }

    flagSubmitStatus = undefined;

    // TODO: better progress and error handling
    const r = await api.POST("/challenges/{id}/solves", {
      params: { path: { id: challData!.id } },
      body: {
        data: flagInput.trim(),
      },
    });

    if (r.error) {
      toasts.error((r as {error: { message: string }}).error.message);
      return;
    }
    if (r.data) {
      flagSubmitStatus = r.data.data;
      if (flagSubmitStatus == "correct") {
        correctAnim.set(1);
        onSolve();
      } else {
        setTimeout(() => {
          flagSubmitStatus = undefined;
        }, 2000);
      }
    }
  }

  function performClose() {
    flagSubmitStatus = undefined;
    scoreModalVisible = false;
    scoresData = undefined;
    scoresLoading = false;
    flagInput = "";
    correctAnim.set(0);
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

  async function toggleScores() {
    scoreModalVisible = !scoreModalVisible;
    if (scoreModalVisible && !scoresLoading && !scoresData && challData) {
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
        class="bg-base-200 rounded-lg pop w-full p-6 h-fit"
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
                    toggleScores();
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
                      <a
                        href="{API_BASE_URL}/challenges/{challData?.id}/files/{file}"
                        class="link text-primary font-semibold">{file}</a
                      >
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
          {/if}
        </div>

        {#if challData?.isSolved}
          <div class="flex gap-2">
            <input
              type="text"
              placeholder={"You've solved this challenge!"}
              class="input input-bordered flex-grow !bg-base-100"
              disabled
            />
            <button disabled class="btn btn-primary btn-disabled">Submit</button
            >
          </div>
        {:else}
          <form class="flex gap-2 w-full">
            <div class="relative w-full">
              <input
                bind:value={flagInput}
                oninput={() => (flagSubmitStatus = undefined)}
                type="text"
                placeholder={"noCTF{...}"}
                required
                class={"w-full input input-bordered flex-grow pop duration-200 transition-colors focus:outline-none focus:pop focus:ring-0 focus:ring-offset-0 " +
                  (flagSubmitStatus == "incorrect"
                    ? "bg-error shake text-base-content/30"
                    : "bg-base-100")}
              />
              {#if flagSubmitStatus == "correct"}
                <div
                  class="absolute inset-0 overflow-hidden rounded-lg pointer-events-none pop"
                >
                  <div
                    class="absolute left-0 top-0 h-full bg-success"
                    style="width: {correctAnim.current * 100}%"
                  ></div>
                </div>

                <div
                  class="absolute inset-0 flex items-center justify-center"
                  transition:fade={{ duration: 400 }}
                >
                  <span
                    class="text-success-content font-bold"
                    in:fly={{ y: 40, duration: 400 }}
                  >
                    Correct! 🎉
                  </span>
                </div>
              {:else if flagSubmitStatus == "incorrect"}
                <div
                  class="absolute inset-0 flex items-center justify-center pointer-events-none"
                  transition:fade={{ duration: 400 }}
                >
                  <span
                    class="text-error-content font-bold"
                    in:fly={{ y: 40, duration: 400 }}
                  >
                    Incorrect...
                  </span>
                </div>
              {/if}
            </div>
            <button
              type="submit"
              onclick={submitFlag}
              class="btn pop btn-primary">Submit</button
            >
          </form>
        {/if}
      </div>
      {#if scoreModalVisible}
        <div
          class="bg-base-200 rounded-lg pop w-full md:w-[32rem] p-6 px-3 h-full"
          bind:this={scoreModalRef}
        >
          <h2 class="text-center text-xl font-semibold">Solves</h2>
          {#if scoresLoading}
            <div class="flex flex-col items-center gap-4 my-16">
              <div
                class="loading loading-spinner loading-lg text-primary"
              ></div>
              <p class="text-center">Loading solves...</p>
            </div>
          {:else if scoresData?.length == 0}
            <div class="mt-4 text-center items-center align-center">
              No solves yet, be the first!
            </div>
          {:else}
            <div class="overflow-x-hidden overflow-y-auto max-h-[46vh]">
              <table class="table table-fixed table-bordered">
                <thead class="h-4">
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
                        <a
                          href="/team/{teamId}"
                          class="block truncate hover:text-primary-focus"
                        >
                          {#await TeamNamesService.get(teamId)}
                            loading...
                          {:then name}
                            {name}
                          {/await}
                        </a>
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
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style lang="postcss">
  .shake {
    animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }

  @keyframes shake {
    10%,
    90% {
      transform: translate3d(-1px, 0, 0);
    }
    20%,
    80% {
      transform: translate3d(2px, 0, 0);
    }
    30%,
    50%,
    70% {
      transform: translate3d(-2px, 0, 0);
    }
    40%,
    60% {
      transform: translate3d(2px, 0, 0);
    }
  }
</style>
