<script lang="ts">
  import Icon from "@iconify/svelte";
  import type { ChallengeStat } from "./ChallengeStatsTable.svelte";

  export interface UserStat {
    user_count: number;
    team_count: number;
    team_tag_counts: {
      id: number;
      team_count: number;
    }[];
  }

  interface Props {
    challengeStats: ChallengeStat[];
    userStats: UserStat;
    teamTags: { id: number; name: string }[];
    loading?: boolean;
    title?: string;
  }

  let {
    challengeStats,
    userStats,
    teamTags,
    loading: _loading = false,
    title: _title,
  }: Props = $props();

  const aggregateStats = $derived.by(() => {
    if (!challengeStats || challengeStats.length === 0) {
      return {
        total_challenges: 0,
        released_challenges: 0,
        scheduled_challenges: 0,
        hidden_challenges: 0,
        solved_challenges: 0,
        unsolved_challenges: 0,
        total_submissions: 0,
        correct_submissions: 0,
        incorrect_submissions: 0,
      };
    }

    const now = new Date();
    let released = 0;
    let scheduled = 0;
    let hidden = 0;
    let solved = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;

    challengeStats.forEach((stat) => {
      if (stat.hidden) {
        hidden++;
      } else if (!stat.released_at || new Date(stat.released_at) <= now) {
        released++;
      } else {
        scheduled++;
      }

      if (stat.correct_count > 0) {
        solved++;
      }

      totalCorrect += stat.correct_count;
      totalIncorrect += stat.incorrect_count;
    });

    return {
      total_challenges: challengeStats.length,
      released_challenges: released,
      scheduled_challenges: scheduled,
      hidden_challenges: hidden,
      solved_challenges: solved,
      unsolved_challenges: challengeStats.length - solved,
      total_submissions: totalCorrect + totalIncorrect,
      correct_submissions: totalCorrect,
      incorrect_submissions: totalIncorrect,
    };
  });
</script>

{#snippet numberCard(
  title: string,
  icon: string,
  colour: string,
  value: number | string,
)}
  <div
    class="bg-base-200 flex flex-col justify-between rounded-lg p-4 w-full sm:w-52"
  >
    <div class="flex items-center gap-2 mb-2">
      <Icon {icon} class="text-lg {colour} min-w-6" />
      <span class="text-sm font-medium text-base-content/70">{title}</span>
    </div>
    <div class="text-2xl font-bold text-base-content">{value}</div>
  </div>
{/snippet}

<div class="space-y-6">
  <!-- Users Section -->
  <div class="card bg-base-100 pop rounded-lg">
    <div class="card-body">
      <div class="flex items-center gap-3 mb-6">
        <Icon icon="material-symbols:person" class="text-3xl text-secondary" />
        <h3 class="text-2xl font-bold">Users</h3>
      </div>

      <div class="flex flex-col gap-4">
        <div class="flex flex-row gap-4">
          {@render numberCard(
            "Users",
            "material-symbols:person",
            "text-primary",
            userStats.user_count,
          )}

          {@render numberCard(
            "Teams",
            "mdi:account-group",
            "text-secondary",
            userStats.team_count,
          )}
        </div>

        <div class="flex flex-row flex-wrap gap-4">
          {#each userStats.team_tag_counts?.toSorted((a, b) => a.id - b.id) as ttc}
            {@render numberCard(
              teamTags.find(({ id }) => id === ttc.id)!.name,
              "material-symbols:auto-label",
              "text-info",
              ttc.team_count,
            )}
          {/each}
        </div>
      </div>
    </div>
  </div>
  <!-- Challenges section -->
  <div class="card bg-base-100 pop rounded-lg">
    <div class="card-body">
      <div class="flex items-center gap-3 mb-6">
        <Icon icon="material-symbols:quiz" class="text-3xl text-primary" />
        <h3 class="text-2xl font-bold">Challenges</h3>
      </div>

      <div class="flex flex-row flex-wrap gap-4">
        {@render numberCard(
          "Total",
          "material-symbols:quiz",
          "text-primary",
          aggregateStats.total_challenges,
        )}

        {@render numberCard(
          "Released",
          "material-symbols:visibility",
          "text-success",
          aggregateStats.released_challenges,
        )}

        {#if aggregateStats.scheduled_challenges > 0}
          {@render numberCard(
            "Scheduled",
            "material-symbols:schedule",
            "text-warning",
            aggregateStats.scheduled_challenges,
          )}
        {/if}

        {#if aggregateStats.hidden_challenges > 0}
          {@render numberCard(
            "Hidden",
            "material-symbols:visibility-off",
            "text-gray-500",
            aggregateStats.hidden_challenges,
          )}
        {/if}

        {@render numberCard(
          "Solved",
          "material-symbols:check-circle",
          "text-success",
          aggregateStats.solved_challenges,
        )}

        {@render numberCard(
          "Unsolved",
          "material-symbols:pending-actions",
          "text-base-content/50",
          aggregateStats.unsolved_challenges,
        )}
      </div>
    </div>
  </div>

  <!-- Submissions Section -->
  <div class="card bg-base-100 pop rounded-lg">
    <div class="card-body">
      <div class="flex items-center gap-3 mb-6">
        <Icon icon="material-symbols:send" class="text-3xl text-secondary" />
        <h3 class="text-2xl font-bold">Submissions</h3>
      </div>

      <div class="flex flex-row gap-4">
        {@render numberCard(
          "Total",
          "material-symbols:send",
          "text-secondary",
          aggregateStats.total_submissions,
        )}

        {@render numberCard(
          "Correct",
          "mdi:flag",
          "text-success",
          aggregateStats.correct_submissions,
        )}

        {@render numberCard(
          "Incorrect",
          "mdi:flag-off",
          "text-error",
          aggregateStats.incorrect_submissions,
        )}
      </div>
    </div>
  </div>
</div>
