<script lang="ts">
  import Icon from "@iconify/svelte";
  import UserQueryService from "$lib/state/user_query.svelte";
  import TeamQueryService from "$lib/state/team_query.svelte";
  import api from "$lib/api/index.svelte";

  interface Submission {
    id: number;
    user_id: number | null;
    team_id: number;
    challenge_id: number;
    data: string;
    comments: string;
    source: string;
    hidden: boolean;
    value: number | null;
    status: "invalid" | "incorrect" | "correct" | "queued";
    created_at: string;
    updated_at: string;
  }

  interface Props {
    submissions: Submission[];
    challengeMap?: Map<number, string>;
    showUser?: boolean;
    showTeam?: boolean;
    showActions?: boolean;
    variant?: "full" | "compact";
    onVisibilityToggle?: (id: number, hidden: boolean) => void;
  }

  let {
    submissions,
    challengeMap = new Map(),
    showUser = true,
    showTeam = true,
    showActions = true,
    variant = "full",
    onVisibilityToggle,
  }: Props = $props();

  function formatDateTime(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  function getSubmissionStatusBadgeClass(status: string) {
    switch (status) {
      case "correct":
        return "badge-success";
      case "incorrect":
        return "badge-error";
      case "queued":
        return "badge-warning";
      case "invalid":
        return "badge-neutral";
      default:
        return "badge-ghost";
    }
  }

  async function handleVisibilityToggle(id: number, hidden: boolean) {
    if (!onVisibilityToggle) return;
    onVisibilityToggle(id, hidden);
  }
</script>

<div class="overflow-x-auto pop rounded-lg">
  <table
    class="table {variant === 'full'
      ? 'table-sm table-fixed'
      : ''} bg-base-100 w-full"
    aria-label="Submissions list"
  >
    <thead>
      <tr
        class={variant === "full"
          ? "bg-base-300 border-b-2 border-base-400"
          : "border-y border-base-300 bg-base-200"}
      >
        <th
          scope="col"
          class={variant === "full"
            ? "w-16 border-r-2 border-base-400 text-center font-semibold"
            : "border-y border-base-300 py-2 px-3 text-left font-bold"}
        >
          ID
        </th>
        <th
          scope="col"
          class={variant === "full"
            ? "w-48 border-r-2 border-base-400 font-semibold"
            : "border-y border-base-300 py-2 px-3 text-left font-bold"}
        >
          Challenge
        </th>
        {#if showUser}
          <th
            scope="col"
            class={variant === "full"
              ? "w-32 border-r-2 border-base-400 font-semibold"
              : "border-y border-base-300 py-2 px-3 text-left font-bold"}
          >
            User
          </th>
        {/if}
        {#if showTeam}
          <th
            scope="col"
            class={variant === "full"
              ? "w-32 border-r-2 border-base-400 font-semibold"
              : "border-y border-base-300 py-2 px-3 text-left font-bold"}
          >
            Team
          </th>
        {/if}
        <th
          scope="col"
          class={variant === "full"
            ? "w-24 border-r-2 border-base-400 text-center font-semibold"
            : "border-y border-base-300 py-2 px-3 text-center font-bold"}
        >
          Status
        </th>
        <th
          scope="col"
          class={variant === "full"
            ? "w-48 border-r-2 border-base-400 font-semibold"
            : "border-y border-base-300 py-2 px-3 text-left font-bold"}
        >
          Data
        </th>
        <th
          scope="col"
          class={variant === "full"
            ? "w-32 border-r-2 border-base-400 text-center font-semibold"
            : "border-y border-base-300 py-2 px-3 text-center font-bold"}
        >
          Created
        </th>
        {#if showActions}
          <th
            scope="col"
            class={variant === "full"
              ? "w-24 text-center font-semibold"
              : "border-y border-base-300 py-2 px-3 text-center font-bold"}
          >
            Actions
          </th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#each submissions as submission}
        <tr
          class="{variant === 'full'
            ? 'border border-r border-base-300 hover:bg-base-50 transition-colors'
            : 'bg-base-100 hover:bg-base-300/30'} {submission.hidden
            ? 'opacity-60'
            : ''}"
        >
          <td
            class={variant === "full"
              ? "border-r border-base-400 text-center font-mono text-sm"
              : "border-y border-base-300 py-2 px-3 font-mono text-sm"}
          >
            {submission.id}
            {#if submission.hidden}
              <span class="badge badge-neutral badge-xs ml-1">Hidden</span>
            {/if}
          </td>
          <td
            class={variant === "full"
              ? "border-r border-base-400"
              : "border-y border-base-300 py-2 px-3"}
          >
            <div class="flex flex-col">
              <span class="font-medium">
                {challengeMap.get(submission.challenge_id) ||
                  `Challenge ${submission.challenge_id}`}
              </span>
              <span class="text-sm text-base-content/60 font-mono"
                >ID: {submission.challenge_id}</span
              >
            </div>
          </td>
          {#if showUser}
            <td
              class={variant === "full"
                ? "border-r border-base-400"
                : "border-y border-base-300 py-2 px-3"}
            >
              {#if submission.user_id}
                {#await UserQueryService.get(submission.user_id)}
                  <span class="text-base-content/60"
                    >User {submission.user_id}</span
                  >
                {:then user}
                  <div class="flex flex-col">
                    <a
                      href="/admin/user/{submission.user_id}"
                      class="link link-primary font-medium"
                    >
                      {user?.name || `User ${submission.user_id}`}
                    </a>
                    <span class="text-sm text-base-content/60 font-mono"
                      >ID: {submission.user_id}</span
                    >
                  </div>
                {:catch}
                  <span class="text-base-content/60"
                    >User {submission.user_id}</span
                  >
                {/await}
              {:else}
                <span class="text-base-content/60 italic">System</span>
              {/if}
            </td>
          {/if}
          {#if showTeam}
            <td
              class={variant === "full"
                ? "border-r border-base-400"
                : "border-y border-base-300 py-2 px-3"}
            >
              {#await TeamQueryService.get(submission.team_id)}
                <span class="text-base-content/60"
                  >Team {submission.team_id}</span
                >
              {:then team}
                <div class="flex flex-col">
                  <a
                    href="/admin/team/{submission.team_id}"
                    class="link link-primary font-medium"
                  >
                    {team?.name || `Team ${submission.team_id}`}
                  </a>
                  <span class="text-sm text-base-content/60 font-mono"
                    >ID: {submission.team_id}</span
                  >
                </div>
              {:catch}
                <span class="text-base-content/60"
                  >Team {submission.team_id}</span
                >
              {/await}
            </td>
          {/if}
          <td
            class={variant === "full"
              ? "border-r border-base-400 text-center"
              : "border-y border-base-300 py-2 px-3 text-center"}
          >
            <span
              class="badge {getSubmissionStatusBadgeClass(
                submission.status,
              )} badge-sm"
            >
              {submission.status}
            </span>
          </td>
          <td
            class={variant === "full"
              ? "border-r border-base-400"
              : "border-y border-base-300 py-2 px-3 max-w-xs"}
          >
            <div
              class="truncate font-mono text-sm {variant === 'full'
                ? 'max-w-xs'
                : ''}"
              title={submission.data}
            >
              {submission.data}
            </div>
          </td>
          <td
            class={variant === "full"
              ? "border-r border-base-400 text-center text-sm text-base-content/70 font-mono"
              : "border-y border-base-300 py-2 px-3 text-center text-sm text-base-content/70 font-mono"}
          >
            {formatDateTime(submission.created_at)}
          </td>
          {#if showActions}
            <td
              class={variant === "full"
                ? "text-center"
                : "border-y border-base-300 py-2 px-3 text-center"}
            >
              <button
                class="btn btn-error btn-xs pop hover:pop"
                onclick={() =>
                  handleVisibilityToggle(submission.id, submission.hidden)}
              >
                {submission.hidden ? "Unhide" : "Hide"}
              </button>
            </td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
