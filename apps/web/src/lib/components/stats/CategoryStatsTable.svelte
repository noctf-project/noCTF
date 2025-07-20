<script module lang="ts">
  import type { UserStat } from "./StatsOverview.svelte";
  import type { ChallengeStat } from "./ChallengeStatsTable.svelte";

  export type CategoryStat = {
    category: string;
    challenge_count: number;
    avg_points: number;
    total_points: number;
    avg_solves: number;
    total_solves: number;
    total_submissions: number;
    avg_blood_time: number;
  };

  export interface ChallengeStatsTableProps {
    challengeStats: ChallengeStat[];
    userStats: UserStat;
    challengeMap: Map<
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
</script>

<script lang="ts">
  import Icon from "@iconify/svelte";
  import { categoryToIcon, getCategoriesFromTags } from "$lib/utils/challenges";
  import { formatTimeDifference } from "$lib/utils/time";

  const {
    challengeStats,
    challengeMap,
    loading = false,
  }: ChallengeStatsTableProps = $props();

  let challengeStatsByCategory = $derived.by(() => {
    const grouped: { [category: string]: ChallengeStat[] } = {};

    for (const challengeStat of challengeStats) {
      const challenge = challengeMap.get(challengeStat.id)!;
      const categories = getCategoriesFromTags(challenge.tags);
      const primaryCategory =
        categories.length > 0 ? categories[0]! : "uncategorized";

      if (!grouped[primaryCategory]) {
        grouped[primaryCategory] = [];
      }
      grouped[primaryCategory].push(challengeStat);
    }

    return grouped;
  });

  const stats = $derived(
    Object.entries(challengeStatsByCategory)
      .map(([category, categoryChallengeStats]): CategoryStat => {
        const challenge_count = categoryChallengeStats.length;
        const total_points = categoryChallengeStats.reduce(
          (a, v) => a + challengeMap.get(v.id)!.value,
          0,
        );
        const avg_points = Math.round(total_points / challenge_count);
        const total_solves = categoryChallengeStats.reduce(
          (a, v) => a + v.correct_count,
          0,
        );
        const avg_solves = Math.round(total_solves / challenge_count);
        const total_submissions = categoryChallengeStats.reduce(
          (a, v) => a + v.correct_count + v.incorrect_count,
          0,
        );
        const bloodCount = categoryChallengeStats.filter(
          (v) => v.first_solve && v.released_at,
        ).length;
        const avg_blood_time = bloodCount
          ? Math.round(
              categoryChallengeStats.reduce((a, v) => {
                if (!v.first_solve || !v.released_at) return a;
                return (
                  a +
                  (new Date(v.first_solve).getTime() -
                    new Date(v.released_at).getTime())
                );
              }, 0) / bloodCount,
            )
          : 0;
        return {
          category,
          challenge_count,
          total_points,
          avg_points,
          avg_solves,
          total_solves,
          total_submissions,
          avg_blood_time,
        };
      })
      .toSorted((a, b) => b.avg_solves - a.avg_solves),
  );
</script>

{#snippet headerWithTooltip(title: string, tooltip: string)}
  <div
    class="w-full text-center justify-center flex flex-row gap-2 items-center align-middle"
  >
    {title}
    <div class="tooltip" data-tip={tooltip}>
      <Icon icon="material-symbols:help" class="text-sm opacity-60" />
    </div>
  </div>
{/snippet}

<div class="card bg-base-100 pop rounded-lg">
  <div class="card-body p-0">
    <table class="table table-zebra w-full table-fixed">
      <thead class="bg-base-200">
        <tr>
          <th class="text-left w-20 border-r-2 border-base-400">Category</th>
          <th class="w-16">
            {@render headerWithTooltip(
              "Challenges",
              "Number of challenges in category",
            )}
          </th>
          <th class="text-center w-16">
            {@render headerWithTooltip(
              "Avg. points",
              "Average point value of challenges in category",
            )}
          </th>
          <th class="text-center w-16">
            {@render headerWithTooltip(
              "Total points",
              "Total point value of all challenges in category",
            )}
          </th>
          <th class="text-center w-16">
            {@render headerWithTooltip(
              "Avg. solves",
              "Average number of solves per challenge in category",
            )}
          </th>
          <th class="text-center w-16">
            {@render headerWithTooltip(
              "Total solves",
              "Total number of solves across all challenges in category",
            )}
          </th>
          <th class="text-center w-16">
            {@render headerWithTooltip(
              "Total attempts",
              "Total number of submission attempts across all challenges in category",
            )}
          </th>
          <th class="text-center w-16">
            {@render headerWithTooltip(
              "Avg. blood time",
              "Average time from challenge release to first solve in category",
            )}
          </th>
        </tr>
      </thead>
      <tbody>
        {#if loading}
          {#each Array(5) as _}
            <tr>
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
        {:else if stats.length === 0}
          <tr>
            <td colspan="8" class="text-center py-8 text-base-content/70">
              No challenge statistics available
            </td>
          </tr>
        {:else}
          {#each stats as stat (stat.category)}
            <tr class="hover:bg-base-200/50">
              <td class="w-full flex flex-row gap-4">
                <Icon icon={categoryToIcon(stat.category)} class="text-lg" />
                {stat.category}
              </td>
              <td
                class="text-center font-mono font-bold w-20 border-l-2 border-base-400"
              >
                {stat.challenge_count}
              </td>
              <td class="text-center font-mono font-bold w-16">
                {stat.avg_points}
              </td>
              <td class="text-center font-mono font-bold w-16">
                {stat.total_points}
              </td>
              <td class="text-center font-mono font-bold w-16">
                {stat.avg_solves}
              </td>
              <td class="text-center font-mono font-bold w-16">
                {stat.total_solves}
              </td>
              <td class="text-center font-mono font-bold w-16">
                {stat.total_submissions}
              </td>
              <td class="text-center font-mono font-bold w-16">
                {#if !stat.avg_blood_time}
                  -
                {:else}
                  {formatTimeDifference(
                    new Date(stat.avg_blood_time),
                    new Date(0),
                  )}
                {/if}
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
