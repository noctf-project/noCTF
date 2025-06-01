<script lang="ts">
  import Icon from "@iconify/svelte";
  import { countryCodeToFlag, countryCodeToName } from "$lib/utils/country";
  import { ordinal } from "$lib/utils/ordinal";
  import TeamQueryService from "$lib/state/team_query.svelte";
  import UserQueryService, { type User } from "$lib/state/user_query.svelte";
  import { wrapLoadable } from "$lib/api/index.svelte";
  import api from "$lib/api/index.svelte";
  import {
    categoryToIcon,
    difficultyToBgColour,
    getCategoriesFromTags,
    getDifficultyFromTags,
  } from "$lib/utils/challenges";
  import { getRelativeTime } from "$lib/utils/time";
  import type { Difficulty } from "$lib/constants/difficulties";
  import Graph from "$lib/components/scoreboard/Graph.svelte";
  import authState from "$lib/state/auth.svelte";

  export interface Props {
    teamId: number;
  }

  type MemberWithDetails = User & {
    role: string;
    solveCount: number;
    totalPoints: number;
    categories: [string, number][];
  };

  type ChallengeEntry = {
    id: number;
    title: string;
    points: number;
    difficulty: Difficulty;
    categories: string[];
  };

  type SolveEntry = ChallengeEntry & {
    solver: {
      id: number;
      name: string;
    };
    value: number;
    created_at: Date;
  };

  let { teamId }: Props = $props();
  let teamLoader = wrapLoadable(TeamQueryService.get(teamId));
  let team = $derived(teamLoader.r);
  let showEditButton = $derived(
    team &&
      team.id === authState.user?.team_id &&
      team.members.some(
        (m) => m.user_id === authState.user?.id && m.role === "owner",
      ),
  );
  let scoreboardLoader = wrapLoadable(
    api.GET("/scoreboard/teams/{id}", {
      params: {
        path: { id: teamId },
      },
    }),
  );
  const challengesLoader = wrapLoadable(api.GET("/challenges"));
  let memberLoaders = $derived(
    team?.members?.map(({ user_id }) =>
      wrapLoadable(UserQueryService.get(user_id)),
    ),
  );
  const teamTagsLoader = wrapLoadable(api.GET("/team_tags"));

  const teamTags = $derived(teamTagsLoader.r?.data?.data?.tags || []);

  let scoreboardData = $derived.by(() => {
    if (scoreboardLoader.loading || !team) return undefined;
    const data = scoreboardLoader.r?.data?.data;
    return (
      data || {
        team_id: team?.id,
        tag_ids: team?.tag_ids,
        score: undefined,
        rank: undefined,
        last_solve: undefined,
        solves: [],
        awards: [],
        graph: undefined,
      }
    );
  });
  const challenges: ChallengeEntry[] | undefined = $derived(
    challengesLoader.loading
      ? undefined
      : challengesLoader.r?.data?.data.challenges
          .map((c) => ({
            id: c.id,
            title: c.title,
            points: c.value || 0,
            categories: getCategoriesFromTags(c.tags),
            difficulty: getDifficultyFromTags(c.tags) as Difficulty,
          }))
          .sort((a, b) => a.points - b.points) || [],
  );

  let membersLoading = $derived(
    teamLoader.loading ||
      scoreboardLoader.loading ||
      !memberLoaders ||
      memberLoaders.some((loader) => loader.loading),
  );

  let members = $derived.by(() => {
    if (
      !memberLoaders ||
      membersLoading ||
      !team ||
      !scoreboardData ||
      !challenges
    )
      return undefined;

    const roleMap = new Map(
      team.members.map(({ user_id, role }) => [user_id, role]),
    );
    const challengeMap = new Map(challenges.map((v) => [v.id, v]));

    const userSolveMap = new Map();
    const userPointsMap = new Map();

    if (scoreboardData.solves) {
      scoreboardData.solves.forEach((solve) => {
        if (!solve.user_id) return;

        userSolveMap.set(
          solve.user_id,
          (userSolveMap.get(solve.user_id) || []).concat([solve]),
        );

        userPointsMap.set(
          solve.user_id,
          (userPointsMap.get(solve.user_id) || 0) + solve.value,
        );
      });
    }

    const userSolvesToCategoryCounts = (
      solves: { challenge_id: number; value: number }[],
    ) => {
      if (!solves) return [];
      const out = solves.reduce((a, v) => {
        const c = challengeMap.get(v.challenge_id)!;
        c.categories.forEach((cat) => {
          a.set(cat, (a.get(cat) || 0) + v.value);
        });
        return a;
      }, new Map());
      return Array.from(out.entries()).toSorted(([_, a], [__, b]) => b - a);
    };

    return memberLoaders
      .map((loader) => loader.r)
      .filter(Boolean)
      .map((user) => {
        const userId = user!.id;
        return {
          ...user!,
          role: roleMap.get(userId) || "member",
          solveCount: userSolveMap.get(userId)?.length || 0,
          totalPoints: userPointsMap.get(userId) || 0,
          categories: userSolvesToCategoryCounts(userSolveMap.get(userId)),
        } as MemberWithDetails;
      });
  });

  let solves = $derived.by(() => {
    if (!scoreboardData || challenges === undefined || members === undefined)
      return undefined;

    const memberMap = new Map(members.map((v) => [v.id, v]));
    const challengeMap = new Map(challenges.map((v) => [v.id, v]));

    return scoreboardData.solves
      .map((s) => {
        const member = memberMap.get(s.user_id!);
        const challenge = challengeMap.get(s.challenge_id);
        return {
          ...challenge,
          solver: {
            id: member?.id,
            name: member?.name,
          },
          value: s.value,
          created_at: new Date(s.created_at),
        } as SolveEntry;
      })
      .toSorted((a, b) => b.created_at.getTime() - a.created_at.getTime());
  });
</script>

{#snippet memberCard(member: MemberWithDetails)}
  <div
    class="group relative bg-base-100 overflow rounded-xl border border-base-300 p-5 flex flex-col
        hover:border-primary hover:shadow-md transition-all duration-200 pop hover:pop"
  >
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-xl font-bold truncate" title={member.name}>
        {member.name}
      </h2>
      {#if member.role === "owner"}
        <div
          class="bg-primary text-primary-content text-xs p-0.5 px-2 rounded-md"
        >
          captain
        </div>
      {/if}
    </div>
    <p class="text-sm text-base-content/70 line-clamp-1 h-5 italic">
      {member.bio}
    </p>
    <div class="divider divider-start">
      <div class="flex flex-row gap-1">
        {#each member.categories as [cat, val]}
          <div class="tooltip text-lg" data-tip={`${cat} - ${val} points`}>
            <Icon icon={categoryToIcon(cat)} />
          </div>
        {/each}
      </div>
    </div>
    <div class="mt-auto flex justify-between items-center">
      <div class="flex flex-row items-center gap-1 font-bold text-xl">
        <Icon icon="material-symbols:flag" class="text-3xl" />
        {member.solveCount}
      </div>
      <div class="flex flex-row items-center gap-1 font-bold text-xl">
        <Icon icon="material-symbols:stars-outline-rounded" class="text-3xl" />
        {member.totalPoints}
      </div>
    </div>
  </div>
{/snippet}

{#snippet solvesTable(solves: SolveEntry[])}
  <div
    class="pop border border-base-500 bg-base-100 rounded-lg overflow-x-auto h-full"
  >
    <table class="w-full border-collapse">
      <thead>
        <tr>
          <th
            class="border-y border-base-300 bg-base-200 py-2 px-3 text-left font-bold"
            >Challenge</th
          >
          <th
            class="border-y border-base-300 bg-base-200 py-2 px-3 text-center font-bold w-32"
          ></th>
          <th
            class="border-y border-base-300 bg-base-200 py-2 px-3 text-center font-bold w-20"
          ></th>
          <th
            class="border border-base-300 bg-base-200 py-2 px-3 text-center font-bold w-20"
            >Points</th
          >
          <th
            class="border border-base-300 bg-base-200 py-2 px-3 text-center font-bold"
            >Solver</th
          >
          <th
            class="border border-base-300 bg-base-200 py-2 px-3 text-center font-bold w-32"
            >Solved At</th
          >
        </tr>
      </thead>
      <tbody>
        {#each solves as solve (`solve-${solve.id}-${solve.solver.id}`)}
          <tr class="bg-base-100 hover:bg-base-300/30">
            <td class="border-y border-base-300 py-2 px-3">
              <div class="font-medium">{solve.title}</div>
            </td>
            <td class="border-y border-base-300 py-2 px-3">
              <div class="flex flex-wrap justify-center gap-1">
                {#each solve.categories as cat}
                  <div class="tooltip text-xl" data-tip={cat}>
                    <Icon icon={categoryToIcon(cat)} />
                  </div>
                {/each}
              </div>
            </td>
            <td class="border-y border-base-300 py-2 px-3">
              <div class="flex flex-wrap justify-center gap-1">
                {#if solve.difficulty}
                  <div
                    class={`badge badge-sm rounded-xl text-xs text-base-500 font-black pop ${difficultyToBgColour(solve.difficulty)}`}
                  >
                    {solve.difficulty}
                  </div>
                {/if}
              </div>
            </td>
            <td
              class="border border-base-300 py-2 px-3 text-center font-mono font-bold"
            >
              {solve.value}
            </td>
            <td class="border border-base-300 py-2 px-3 text-center">
              {solve.solver.name}
            </td>
            <td
              class="border border-base-300 py-2 px-3 text-center text-sm"
              title={solve.created_at.toLocaleString()}
            >
              {getRelativeTime(solve.created_at)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/snippet}

{#snippet emptySolves()}
  <div
    class="flex flex-col items-center justify-center py-8 text-base-content/70"
  >
    <Icon icon="material-symbols:flag-outline" class="text-5xl mb-2" />
    <p class="text-lg font-medium">No solves yet</p>
    <p class="text-sm">This team hasn't solved any challenges</p>
  </div>
{/snippet}

{#if teamLoader.loading}
  <div class="flex flex-col items-center gap-4 mt-16">
    <div class="loading loading-spinner loading-lg text-primary"></div>
    <p class="text-center">Loading...</p>
  </div>
{:else if !teamLoader.loading && team != null}
  <div
    class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8"
  >
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-4 items-center">
        <div class="flex flex-col sm:flex-row gap-4 items-center">
          <div class="w-32"></div>
          <div
            class="flex flex-row items-center gap-4 bg-base-300/80 p-2 px-6 rounded-xl"
          >
            {#if team.country}
              <div class="text-3xl" title={countryCodeToName(team.country)}>
                {countryCodeToFlag(team.country)}
              </div>
            {/if}
            <span class="text-4xl font-bold">{team.name}</span>
          </div>
          {#if showEditButton}
            <a
              href="/team/edit"
              class="btn btn-sm btn-primary pop hover:pop w-32"
            >
              <Icon icon="material-symbols:edit-outline" class="text-lg" />
              Edit Team
            </a>
          {:else}
            <div class="w-32"></div>
          {/if}
        </div>
        {#if team && teamTags}
          <div class="flex flex-row gap-2">
            {#each team.tag_ids as tag_id}
              {@const tag = teamTags.find((t) => t.id === tag_id)}
              {#if tag}
                <div class="p-1 px-4 pop bg-secondary/40 rounded-lg">
                  {tag.name}
                </div>
              {/if}
            {/each}
          </div>
        {/if}
        <div class="flex flex-col gap-4">
          {#if scoreboardLoader.loading && !scoreboardData}
            <div class="skeleton h-4 w-1/2"></div>
          {:else if scoreboardData?.rank && scoreboardData?.score}
            <div
              class="text-3xl font-black pop bg-primary text-primary-content p-1 px-4 rounded-xl"
            >
              <div class="flex flex-col gap-0 items-center">
                <div>{ordinal(scoreboardData.rank)}</div>
                <div class="text-xl font-medium text-primary-content/80">
                  {scoreboardData.score} points
                </div>
              </div>
            </div>
          {/if}
          <p class="text-lg italic text-center">{team.bio}</p>
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <h2 class="text-2xl font-bold divider">Members</h2>
        <div
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {#if members !== undefined}
            {#each members as member}
              {@render memberCard(member)}
            {/each}
          {/if}
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <h2 class="text-2xl font-bold divider">Solves</h2>
        <div class="flex flex-col gap-4">
          {#if solves !== undefined}
            {#if solves.length > 0}
              {@render solvesTable(solves)}
            {:else}
              {@render emptySolves()}
            {/if}

            {#if scoreboardData?.graph}
              <Graph data={[{ name: team.name, data: scoreboardData.graph }]} />
            {/if}
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
