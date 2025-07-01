<script lang="ts">
  import type { ChallengeCardData } from "./ChallengeCard.svelte";
  import { categoryToIcon } from "$lib/utils/challenges";
  import Icon from "@iconify/svelte";
  import { untrack } from "svelte";

  interface ChallengeFiltererProps {
    challenges: ChallengeCardData[];
    onFilter: (filteredChallenges: ChallengeCardData[]) => void;
  }

  let { challenges, onFilter }: ChallengeFiltererProps = $props();
  const allChallenges = $derived(challenges.slice());
  const allSolveCount = $derived(
    allChallenges.filter((c) => c.isSolved).length,
  );
  const unsolvedCount = $derived(
    allChallenges.filter((c) => !c.isSolved).length,
  );
  const allCount = $derived(allChallenges.length);
  const categories = $derived(
    new Set(allChallenges.flatMap((c) => c.categories)),
  );

  // let anyFilter = $state(true);
  let topLevelFilter: "All" | "Unsolved" | "Solved" = $state("All");

  const allFalse = Object.fromEntries(
    Array.from(untrack(() => categories)).map((k) => [k, false]),
  );
  let categoryFilters = $state(allFalse);

  $inspect(categoryFilters);
  $inspect(topLevelFilter);

  const setFilter = (category: string) => {
    if (["All", "Unsolved", "Solved"].includes(category)) {
      topLevelFilter = category as "All" | "Unsolved" | "Solved";
      // categoryFilters = allFalse;
    } else {
      categoryFilters[category] = !categoryFilters[category];
    }
    // const s = new Set(Object.values(categoryFilters).map((f) => f));
    console.log(topLevelFilter);
    console.log(category);
    if (topLevelFilter === category) {
      // topLevelFilter = "All";

      console.log("setting categoryFilters to allFalse");
      categoryFilters = allFalse;
    }
  };

  const getCategoryCounts = (category: string) => {
    const chals = allChallenges.filter((c) =>
      c.categories.find((f) => f == category),
    );
    return {
      solved: chals.filter((c) => c.isSolved).length,
      total: chals.length,
    };
  };

  $effect(() => {
    const topLevelFiltered =
      topLevelFilter === "All"
        ? allChallenges
        : topLevelFilter === "Unsolved"
          ? allChallenges.filter((chal) => !chal.isSolved)
          : allChallenges.filter((chal) => chal.isSolved);

    let filtered = topLevelFiltered;
    const s = new Set(Object.values(categoryFilters).map((f) => f));
    if (s.size > 1) {
      filtered = topLevelFiltered.filter((chal) => {
        const f = new Set(
          Object.keys(categoryFilters).filter((k) => categoryFilters[k]),
        );
        return chal.categories.find((c) => f.has(c));
      });
    }
    const sorted = filtered.sort((a, b) => b.solves - a.solves);
    onFilter(sorted);
  });
</script>

{#snippet categoryBtn(
  category: string,
  displayName: string,
  solved: number,
  total: number,
  countSnippet: (solved: number, total: number, selected: boolean) => any,
)}
  {@const selected =
    category === topLevelFilter || (categoryFilters[category] as boolean)}
  <button
    class="flex items-center w-full text-left px-2 py-1.5 rounded-md transition-colors duration-150 text-sm"
    class:font-semibold={selected}
    class:bg-blue-100={selected}
    class:text-blue-700={selected}
    class:text-gray-700={!selected}
    class:hover:bg-gray-100={!selected}
    onclick={() => setFilter(category)}
  >
    <Icon icon={categoryToIcon(category)} class="w-5 h-5 mr-3 text-gray-400" />
    <span class="flex-grow truncate">{displayName}</span>
    {@render countSnippet(solved, total, selected)}
  </button>
{/snippet}

{#snippet topLevelFilterCount(solved: number, total: number, selected: boolean)}
  <span
    class="text-xs font-bold"
    class:text-blue-600={selected}
    class:text-gray-500={!selected}
  >
    {total}
  </span>
{/snippet}

{#snippet categoryFilterCount(solved: number, total: number, selected: boolean)}
  <span
    class="text-xs"
    class:text-blue-600={selected}
    class:text-gray-500={!selected}
  >
    {solved}/{total}
  </span>
{/snippet}

<div class="flex flex-col gap-1 w-full p-2">
  {@render categoryBtn("All", "All", allCount, allCount, topLevelFilterCount)}
  {@render categoryBtn(
    "Unsolved",
    "Unread",
    unsolvedCount,
    unsolvedCount,
    topLevelFilterCount,
  )}
  {@render categoryBtn(
    "Solved",
    "Sent",
    allSolveCount,
    allSolveCount,
    topLevelFilterCount,
  )}

  <div class="px-2 pt-2 pb-1 text-xs font-bold text-gray-500">FILTERS</div>
  {#each categories as cat}
    {@const counts = getCategoryCounts(cat)}
    {@render categoryBtn(
      cat,
      cat,
      counts.solved,
      counts.total,
      categoryFilterCount,
    )}
  {/each}
</div>
