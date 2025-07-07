<script module lang="ts">
  import { type ChallengeCardData } from "./ChallengeCard.svelte";

  export interface ChallDetails {
    description: string;
    files: { filename: string; url: string; size: number; hash: string }[];
  }
  export interface ChallengeInfoProps {
    challData?: ChallengeCardData;
    challDetails?: ChallDetails;
    loading: boolean;
    onSolve: () => void;
  }

  interface ScoreEntry {
    teamId: number;
    time: Date;
  }
</script>

<script lang="ts">
  import { Carta, Markdown } from "carta-md";
  import { categoryToIcon, formatFileSize } from "$lib/utils/challenges";
  import DOMPurify from "isomorphic-dompurify";
  import Icon from "@iconify/svelte";
  import { type Difficulty } from "$lib/constants/difficulties";
  import { Tween } from "svelte/motion";
  import { cubicInOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";
  import api, { API_BASE_URL } from "$lib/api/index.svelte";
  import { getRelativeTime } from "$lib/utils/time";
  import TeamNamesService from "$lib/state/team_query.svelte";
  import { toasts } from "$lib/stores/toast";
  import DifficultyChip from "./DifficultyChip.svelte";
  import DogAnimation from "./DogAnimation.svelte";
  import authState from "$lib/state/auth.svelte";
  import { goto } from "$app/navigation";
  import { EMAIL_SOUNDS } from "$lib/constants/emailSounds";

  let { challData, challDetails, loading, onSolve }: ChallengeInfoProps =
    $props();

  let flagInput = $state("");
  let flagSubmitStatus:
    | "waiting"
    | "invalid"
    | "submitting"
    | "incorrect"
    | "correct"
    | "queued" = $state("waiting");
  let scoreModalVisible = $state(false);
  let scoresLoading = $state(false);
  let showHash = $state(false);
  let scoresData: ScoreEntry[] | undefined = $state(undefined);
  let scoreModalRef: HTMLElement | undefined = $state();
  let showIncorrectAnimation = $state(false);
  let showCorrectAnimation = $state(false);

  $inspect(showCorrectAnimation);
  $inspect(showIncorrectAnimation);

  let knowsSolvesClick = localStorage.getItem("knowsSolvesClick") == "1";
  let showHint = $state(!knowsSolvesClick);
  setTimeout(() => {
    showHint = false;
  }, 2500);

  // Reset values when challenge data changes
  $effect(() => {
    if (challData) {
      // Reset flag input
      flagInput = "";
      // Reset flag submit status
      flagSubmitStatus = "waiting";
      // Reset animations
      showIncorrectAnimation = false;
      showCorrectAnimation = challData.isSolved;
      // Reset show hash
      showHash = false;
      scoreModalVisible = false;
      scoresData = undefined;
      // Reset correct animation
      correctAnim.set(0);
    }
  });

  const carta = new Carta({
    sanitizer: DOMPurify.sanitize,
  });

  const correctAnim = new Tween(0, {
    duration: 600,
    easing: cubicInOut,
  });

  async function playEmailSentSound(sound: keyof typeof EMAIL_SOUNDS) {
    const audio = new Audio(EMAIL_SOUNDS[sound]);
    audio.play();
  }

  async function submitFlag(e: Event) {
    e.preventDefault();

    if (!flagInput || ["submitting", "correct"].includes(flagSubmitStatus)) {
      return;
    }

    flagSubmitStatus = "submitting";

    // TODO: better progress and error handling
    const r = await api.POST("/challenges/{id}/solves", {
      params: { path: { id: challData!.id } },
      body: {
        data: flagInput.trim(),
      },
    });

    if (r.error) {
      toasts.error((r as { error: { message: string } }).error.message);
      flagSubmitStatus = "waiting";
      return;
    }
    if (r.data) {
      flagSubmitStatus = r.data.data;
      if (flagSubmitStatus == "correct") {
        correctAnim.set(1);
        showCorrectAnimation = true;
        playEmailSentSound("flag-correct");
        onSolve();
      } else {
        playEmailSentSound("flag-incorrect");
        showIncorrectAnimation = true;
        setTimeout(() => {
          showIncorrectAnimation = false;
        }, 2000);
        setTimeout(() => {
          flagSubmitStatus = "waiting";
        }, 2000);
      }
    }
  }

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

<div class="flex flex-row gap-4 w-full justify-center h-full">
  {#if challData}
    <div
      class="bg-base-100 p-4 relative rounded-lg justify-between shadow-xl w-full flex flex-col gap-4"
    >
      <div>
        <!-- Email Header -->
        <div class="pb-4 border-b border-base-200">
          <div class="flex justify-between items-start">
            <div>
              <h2 class="text-2xl font-semibold">RE: {challData?.title}</h2>
            </div>
            <div class="flex flex-row items-center gap-4 text-gray-500 text-sm">
              <div class="flex items-center gap-1">
                <Icon
                  icon="material-symbols:stars-outline-rounded"
                  class="text-xl"
                />
                <span>{challData?.points} pts</span>
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
                  class="flex tooltip items-center gap-1 hover:text-primary"
                  data-tip={scoreModalVisible ? "Hide solvers" : "Show solvers"}
                  onclick={() => {
                    if (!knowsSolvesClick) {
                      localStorage.setItem("knowsSolvesClick", "1");
                    }
                    toggleScores();
                  }}
                >
                  <Icon icon="material-symbols:flag" class="text-xl" />
                  <span>{challData?.solves} solves</span>
                </button>
              </div>
            </div>
          </div>
          <div class="mt-4 flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center bg-gray-200 text-gray-600"
            >
              <Icon
                icon={categoryToIcon(challData?.categories[0] ?? "misc")}
                class="text-2xl"
              />
            </div>
            <div>
              <p class="font-semibold text-sm">
                To: {authState.user?.name}@{authState.user?.team_name
                  ?.replaceAll(" ", "_")
                  .toLowerCase()}.duc.tf
              </p>
              <!-- <p class="text-xs text-gray-500">From: challenges@noctf.local</p> -->
            </div>
            <div class="flex-grow"></div>
            {#if challData?.difficulty}
              <DifficultyChip
                difficulty={challData?.difficulty as Difficulty}
              />
            {/if}
          </div>
        </div>

        <!-- Email Body -->
        <div class="flex">
          {#if loading}
            <div class="flex flex-col gap-4">
              <div
                class="loading loading-spinner loading-lg text-primary"
              ></div>
              <p class="text-center">Loading challenge details...</p>
            </div>
          {:else}
            <!-- I'm not sure why this is needed since svelte isn't re-rendering the component -->
            {#key challDetails?.description}
              <div class="prose w-full">
                <Markdown
                  {carta}
                  value={"Dear " +
                    authState.user?.name +
                    ",\n\n" +
                    challDetails!.description}
                />
              </div>
            {/key}
          {/if}
        </div>
      </div>
      <div class="relative">
        <div class="absolute right-0 -top-40">
          <DogAnimation {showIncorrectAnimation} {showCorrectAnimation} />
        </div>

        <!-- Attachments -->
        {#if !loading && challDetails!.files.length > 0}
          <div class="border-t border-base-200 py-2">
            <div class="flex flex-row gap-2 items-center mb-2">
              <Icon icon="material-symbols:attach-file-rounded" class="text-xl"
              ></Icon>
              <h3 class="text-lg font-bold">Attachments</h3>
              <button
                title="Show file hashes"
                onclick={() => (showHash = !showHash)}
                class="text-gray-400 hover:text-gray-600"
                ><Icon icon="material-symbols:tag-rounded" class="text-xl"
                ></Icon>
              </button>
            </div>
            <ul class="flex flex-row flex-wrap gap-x-4 gap-y-2">
              {#each challDetails!.files as file}
                <li>
                  <a
                    href={file.url.startsWith("http")
                      ? file.url
                      : `${API_BASE_URL}/${file.url}`}
                    class="link text-blue-500 font-semibold"
                    title={`${file.filename} - ${formatFileSize(file.size)}`}
                    >{file.filename}</a
                  >
                  {#if showHash}
                    <pre
                      class="text-xs text-base-content mt-1">{file.hash}</pre>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if challData?.isSolved}
          <div class="flex gap-2">
            <input
              type="text"
              placeholder={"You've solved this challenge!"}
              class="input input-bordered flex-grow !bg-base-100"
              disabled
            />
          </div>
        {:else if !authState.isPartOfTeam}
          <div class="flex justify-center gap-2">
            <button
              onclick={() => {
                goto("/team");
              }}
              class="btn btn-primary"
            >
              Sign up to a team
            </button>
          </div>
        {:else}
          <form class="flex gap-2 w-full">
            <div class="relative w-full">
              <input
                bind:value={flagInput}
                oninput={() => {
                  if (flagSubmitStatus !== "correct") {
                    flagSubmitStatus = "waiting";
                  }
                }}
                type="text"
                disabled={["correct", "submitting"].includes(flagSubmitStatus)}
                placeholder={"DUCTF{...}"}
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
              class="btn pop hover:pop btn-primary bg-blue-500"
              disabled={!authState.isPartOfTeam || flagInput.length == 0}
              >Reply
              <Icon icon="material-symbols:send" class="text-xl" /></button
            >
          </form>
        {/if}
      </div>
    </div>

    {#if scoreModalVisible}
      <div
        class="bg-base-200 rounded-lg pop w-full md:max-w-80 p-6 px-3 h-full overflow-hidden"
        bind:this={scoreModalRef}
      >
        <h2 class="text-center text-xl font-semibold">Solves</h2>
        {#if scoresLoading}
          <div class="flex flex-col items-center gap-4 my-16">
            <div class="loading loading-spinner loading-lg text-primary"></div>
            <p class="text-center">Loading solves...</p>
          </div>
        {:else if scoresData?.length == 0}
          <div class="mt-4 text-center items-center align-center">
            No solves yet, be the first!
          </div>
        {:else}
          <div class="overflow-x-hidden overflow-y-auto h-full">
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
          </div>
        {/if}
      </div>
    {/if}
  {:else}
    <div class="flex flex-col justify-center gap-4">
      <p class="text-center">Select an email to read</p>
    </div>
  {/if}
</div>

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
