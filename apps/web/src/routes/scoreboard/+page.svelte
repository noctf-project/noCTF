<script lang="ts">
  import Icon from "@iconify/svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import { getCategoriesFromTags } from "$lib/utils/challenges";

  interface ScoreboardEntry {
    id: number;
    name: string;
    rank: number;
    score: number;
    time: Date;
    solves: number[];
  }

  interface ChallengeEntry {
    id: number;
    title: string;
    points: number;
    categories: string[];
  }

  const apiChallenges = wrapLoadable(api.GET("/challenges"));
  const apiScoreboard = wrapLoadable(api.GET("/scoreboard"));
  const loading = $derived(apiChallenges.loading || apiScoreboard.loading);

  const challenges: ChallengeEntry[] = $derived(apiChallenges.r?.data?.data.challenges.map((c) => ({
    id: c.id,
    title: c.title,
    points: c.score!,
    categories: getCategoriesFromTags(c.tags),
  })).sort((a, b) => a.points - b.points) || [])

  const scoreboard: ScoreboardEntry[] = $derived(apiScoreboard.r?.data?.data.map((s, i) => ({
    rank: i+1,
    ...s,
  })) || []);

  function hasSolved(team: ScoreboardEntry, challengeId: number): boolean {
    return team.solves.includes(challengeId);
  }
</script>

<div class="w-10/12 mx-auto py-4">
  <h1 class="text-3xl font-bold mb-6 text-center">Scoreboard</h1>

  {#if loading}
    <div class="flex flex-col items-center gap-4 mt-16">
      <div class="loading loading-spinner loading-lg text-primary"></div>
      <p class="text-center">Loading scoreboard...</p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <div class="flex flex-row gap-0 w-full ml-[26.5rem]">
        {#each challenges as challenge}
          <div class="relative">
            <div
              class="
                  w-12
                  h-32
                  border
                  border-base-300
                  bg-base-200
                  skew-x-[-45deg]
                  translate-x-16
              "
            ></div>
            <div
              class="
                  absolute
                  bottom-14
                  left-3
                  px-1
                  -rotate-45
                  w-40
                  z-10
                  truncate
              "
              title={`${challenge.title} (${challenge.categories.join(", ")})`}
            >
              {challenge.title}
            </div>
          </div>
        {/each}
      </div>

      <table class="border-collapse w-80 overflow-auto table-fixed">
        <thead class="h-4">
          <tr>
            <th class="border border-base-300 bg-base-200 px-2 py-1 w-8">#</th>
            <th class="border border-base-300 bg-base-200 px-2 py-1 w-64">Team</th
            >
            <th class="border border-base-300 bg-base-200 px-2 py-1 w-20"
              >Score</th
            >
            <th class="border border-base-300 bg-base-200 px-2 py-1 w-14"
              >Flags</th
            >

            {#each challenges as challenge}
              <th
                class="border border-base-300 bg-base-200 w-12 text-center text-sm"
              >
                {challenge.points}
              </th>
            {/each}
          </tr>
        </thead>

        <tbody>
          {#each scoreboard as entry}
            <tr>
              <td class="border border-base-300 text-center h-12">
                {entry.rank}
              </td>
              <td class="border border-base-300 px-4">
                <a href="/team/{entry.id}" class="truncate block" title={entry.name}>
                  {entry.name}
                </a>
              </td>
              <td class="border border-base-300 px-4 text-right">
                {entry.score}
              </td>
              <td class="border border-base-300 px-4 text-center">
                {entry.solves.length}
              </td>
              {#each challenges as challenge}
                {@const solved = hasSolved(entry, challenge.id)}
                <td
                  class={"border border-base-300 p-0 " +
                    (solved ? "bg-primary/20" : "")}
                >
                  <div class="w-full h-full flex items-center justify-center">
                    {#if solved}
                      <Icon
                        icon="material-symbols:flag"
                        class="text-primary text-3xl"
                      />
                    {/if}
                  </div>
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
