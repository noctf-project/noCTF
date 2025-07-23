<script module lang="ts">
  export interface ChallengeStat {
    id: number;
    correct_count: number;
    incorrect_count: number;
    first_solve: string | null;
    first_solve_team_id: number | null;
    released_at: string | null;
    hidden: boolean;
  }

  export type FullChallengeStat = ChallengeStat & {
    value: number;
    total_submissions: number;
    success_rate: number;
    solve_rate: number;
  };

  export interface ChallengeStatsTableProps {
    challengeStats: ChallengeStat[];
    userStats: UserStat;
    challengeMap?: Map<
      number,
      {
        title: string;
        value: number;
        slug: string;
        tags: { [key: string]: string };
      }
    >;
    loading?: boolean;
  }

  export type SortField = keyof FullChallengeStat;
  export type SortDirection = "asc" | "desc";
</script>

<script lang="ts">
  import Icon from "@iconify/svelte";
  import { formatTimeDifference } from "$lib/utils/time";
  import {
    categoryToIcon,
    getCategoriesFromTags,
    getDifficultyFromTags,
  } from "$lib/utils/challenges";
  import DifficultyChip from "../challenges/DifficultyChip.svelte";
  import type { Difficulty } from "$lib/constants/difficulties";
  import TeamQueryService from "$lib/state/team_query.svelte";
  import type { UserStat } from "./StatsOverview.svelte";

  const {
    challengeStats,
    userStats,
    challengeMap,
    loading = false,
  }: ChallengeStatsTableProps = $props();

  let sortField = $state<SortField>("correct_count");
  let sortDirection = $state<SortDirection>("desc");

  let stats = $derived(
    challengeStats.map((c) => {
      let x = {
        ...c,
        solve_rate:
          userStats.team_count > 0
            ? (c.correct_count / userStats.team_count) * 100
            : 0,
        total_submissions: c.correct_count + c.incorrect_count,
        value: challengeMap?.get(c.id)?.value || 0,
      };
      return {
        ...x,
        success_rate:
          x.total_submissions > 0
            ? (c.correct_count / x.total_submissions) * 100
            : 0,
      };
    }),
  );

  const sortedStats = $derived.by(() => {
    if (!stats) return [];

    return [...stats].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return sortDirection === "asc" ? -1 : 1;
      if (bVal === null) return sortDirection === "asc" ? 1 : -1;

      if (
        typeof aVal === "string" &&
        typeof bVal === "string" &&
        (sortField === "first_solve" || sortField === "released_at")
      ) {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      // sort by time to first blood, not absolute time of first blood
      if (
        typeof aVal === "number" &&
        sortField === "first_solve" &&
        a.released_at
      ) {
        aVal -= new Date(a.released_at).getTime();
      }
      if (
        typeof bVal === "number" &&
        sortField === "first_solve" &&
        b.released_at
      ) {
        bVal -= new Date(b.released_at).getTime();
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  });

  function handleSort(field: SortField) {
    if (sortField === field) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortField = field;
      sortDirection = "desc";
    }
  }

  function getSortIcon(field: SortField) {
    if (sortField !== field) return "material-symbols:unfold-more";
    return sortDirection === "asc"
      ? "material-symbols:keyboard-arrow-up"
      : "material-symbols:keyboard-arrow-down";
  }
</script>

<div class="card bg-base-100 pop rounded-lg overflow-hidden">
  <div class="card-body p-0">
    <div class="overflow-x-auto">
      <table class="table table-zebra w-full table-fixed">
        <thead class="bg-base-200">
          <tr>
            <th class="text-left w-80">Challenge</th>
            <th
              class="text-center cursor-pointer hover:bg-base-300 w-20"
              onclick={() => handleSort("value")}
            >
              <div class="flex items-center justify-center gap-1">
                Value
                <Icon icon={getSortIcon("value")} class="text-sm" />
              </div>
            </th>
            <th
              class="text-center cursor-pointer hover:bg-base-300 w-28"
              onclick={() => handleSort("correct_count")}
            >
              <div class="flex items-center justify-center gap-1">
                <Icon icon="mdi:flag" class="text-success" />
                Correct
                <Icon icon={getSortIcon("correct_count")} class="text-sm" />
              </div>
            </th>
            <th
              class="text-center cursor-pointer hover:bg-base-300 w-28"
              onclick={() => handleSort("incorrect_count")}
            >
              <div class="flex items-center justify-center gap-1">
                <Icon icon="mdi:flag-off" class="text-error" />
                Incorrect
                <Icon icon={getSortIcon("incorrect_count")} class="text-sm" />
              </div>
            </th>
            <th
              class="text-center cursor-pointer hover:bg-base-300 w-28"
              onclick={() => handleSort("total_submissions")}
            >
              <div class="flex items-center justify-center gap-1">
                Total
                <Icon icon={getSortIcon("total_submissions")} class="text-sm" />
              </div>
            </th>
            <th
              class="text-center cursor-pointer hover:bg-base-300 w-28"
              onclick={() => handleSort("success_rate")}
            >
              <div class="flex items-center justify-center gap-1">
                Success Rate
                <Icon icon={getSortIcon("success_rate")} class="text-sm" />
              </div>
            </th>
            <th
              class="text-center cursor-pointer hover:bg-base-300 w-28"
              onclick={() => handleSort("solve_rate")}
            >
              <div class="flex items-center justify-center gap-1">
                Solve Rate
                <Icon icon={getSortIcon("solve_rate")} class="text-sm" />
              </div>
            </th>
            <th
              class="text-center cursor-pointer hover:bg-base-300 w-48"
              onclick={() => handleSort("first_solve")}
            >
              <div class="flex items-center justify-center gap-1">
                First Solve
                <Icon icon={getSortIcon("first_solve")} class="text-sm" />
              </div>
            </th>
            <th
              class="text-center cursor-pointer hover:bg-base-300 w-48"
              onclick={() => handleSort("released_at")}
            >
              <div class="flex items-center justify-center gap-1">
                Released
                <Icon icon={getSortIcon("released_at")} class="text-sm" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {#if loading}
            {#each Array(5) as _}
              <tr>
                <td>
                  <div class="flex flex-col gap-1">
                    <div class="skeleton h-4 w-32"></div>
                    <div class="skeleton h-3 w-20"></div>
                  </div>
                </td>
                <td class="text-center"
                  ><div class="skeleton h-4 w-8 mx-auto"></div></td
                >
                <td class="text-center"
                  ><div class="skeleton h-4 w-8 mx-auto"></div></td
                >
                <td class="text-center"
                  ><div class="skeleton h-4 w-8 mx-auto"></div></td
                >
                <td class="text-center"
                  ><div class="skeleton h-4 w-12 mx-auto"></div></td
                >
                <td class="text-center"
                  ><div class="skeleton h-4 w-16 mx-auto"></div></td
                >
                <td class="text-center"
                  ><div class="skeleton h-4 w-16 mx-auto"></div></td
                >
              </tr>
            {/each}
          {:else if sortedStats.length === 0}
            <tr>
              <td colspan="8" class="text-center py-8 text-base-content/70">
                No challenge statistics available
              </td>
            </tr>
          {:else}
            {#each sortedStats as stat (stat.id)}
              {@const challenge = challengeMap?.get(stat.id)}
              <tr class="hover:bg-base-200/50">
                <td class="w-80">
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-2">
                      <span class="font-medium">
                        {challenge?.title || `Challenge #${stat.id}`}
                      </span>
                      {#if stat.released_at && new Date(stat.released_at).getTime() > Date.now()}
                        <div
                          class="tooltip tooltip-right"
                          data-tip="Scheduled to be released at {new Date(
                            stat.released_at,
                          ).toLocaleString()}"
                        >
                          <Icon
                            icon="material-symbols:schedule"
                            class="text-warning text-sm"
                          />
                        </div>
                      {/if}
                      {#if stat.hidden}
                        <div
                          class="tooltip"
                          data-tip="This challenge is hidden"
                        >
                          <Icon
                            icon="material-symbols:visibility-off"
                            class="text-gray-500 text-sm"
                          />
                        </div>
                      {/if}
                    </div>
                    <div class="flex flex-row gap-2">
                      {#if challenge?.tags && getDifficultyFromTags(challenge.tags)}
                        <DifficultyChip
                          difficulty={getDifficultyFromTags(
                            challenge.tags,
                          ) as Difficulty}
                        />
                      {/if}
                      {#if challenge?.tags && getCategoriesFromTags(challenge.tags).length > 0}
                        <div class="flex gap-1 flex-wrap justify-center">
                          {#each getCategoriesFromTags(challenge.tags) as cat}
                            <div class="tooltip" data-tip={cat}>
                              <Icon
                                icon={categoryToIcon(cat)}
                                class="text-lg"
                              />
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </div>
                </td>
                <td class="text-center font-mono font-bold w-28"
                  >{stat.value}</td
                >
                <td class="text-center font-mono font-bold text-success w-28"
                  >{stat.correct_count}</td
                >
                <td class="text-center font-mono font-bold text-error w-28"
                  >{stat.incorrect_count}</td
                >
                <td class="text-center font-mono font-bold w-28"
                  >{stat.total_submissions}</td
                >
                <td class="text-center w-24">
                  <div class="flex flex-col items-center gap-1">
                    <span class="font-mono font-bold"
                      >{stat.success_rate.toFixed(1)}%</span
                    >
                    <div class="w-11/12 bg-base-300 rounded-full h-1">
                      <div
                        class="bg-info h-1 rounded-full transition-all duration-300"
                        style="width: {stat.success_rate}%"
                      ></div>
                    </div>
                  </div>
                </td>
                <td class="text-center w-24">
                  <div class="flex flex-col items-center gap-1">
                    <span class="font-mono font-bold"
                      >{stat.solve_rate.toFixed(1)}%</span
                    >
                    <div class="w-11/12 bg-base-300 rounded-full h-1">
                      <div
                        class="bg-success h-1 rounded-full transition-all duration-300"
                        style="width: {stat.solve_rate}%"
                      ></div>
                    </div>
                  </div>
                </td>
                <td class="text-center w-48">
                  {#if stat.first_solve}
                    <div class="flex flex-col gap-1 items-center">
                      <span
                        class="text-sm font-medium"
                        title={new Date(stat.first_solve).toLocaleString()}
                      >
                        {#if stat.released_at}
                          {formatTimeDifference(
                            new Date(stat.released_at),
                            new Date(stat.first_solve),
                          )}
                        {:else}
                          {new Date(stat.first_solve).toLocaleString()}
                        {/if}</span
                      >
                      {#if stat.first_solve_team_id}
                        {#await TeamQueryService.get(stat.first_solve_team_id)}
                          <div class="skeleton h-4 w-32"></div>
                        {:then team}
                          <a
                            href={`/teams/${team?.id}`}
                            class={`truncate block cursor-pointer bg-base-300/30 hover:bg-base-300/50 p-0.5 px-2 rounded-md font-medium max-w-44`}
                          >
                            {team?.name}
                          </a>
                        {/await}
                      {/if}
                    </div>
                  {:else}
                    <span class="text-base-content/50 text-sm">No solves</span>
                  {/if}
                </td>
                <td class="text-center w-48">
                  {#if stat.released_at}
                    <span class="text-sm"
                      >{new Date(stat.released_at).toLocaleString()}</span
                    >
                  {:else}
                    <span class="text-base-content/50 text-sm">Start</span>
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
