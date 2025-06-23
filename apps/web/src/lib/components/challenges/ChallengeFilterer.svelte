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
  const allCount = $derived(allChallenges.length);
  const categories = $derived(
    new Set(allChallenges.flatMap((c) => c.categories)),
  );

  let anyFilter = $state(true);
  const allFalse = Object.fromEntries(
    Array.from(untrack(() => categories)).map((k) => [k, false]),
  );
  let categoryFilters = $state(allFalse);

  const setFilter = (category: string) => {
    if (category == "All") {
      anyFilter = true;
      categoryFilters = allFalse;
    } else {
      categoryFilters[category] = !categoryFilters[category];
    }
    const s = new Set(Object.values(categoryFilters).map((f) => f));
    if (s.size == 1) {
      anyFilter = true;
      categoryFilters = allFalse;
    } else {
      anyFilter = false;
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
    const filtered = anyFilter
      ? allChallenges
      : allChallenges.filter((chal) => {
          const f = new Set(
            Object.keys(categoryFilters).filter((k) => categoryFilters[k]),
          );
          return chal.categories.find((c) => f.has(c));
        });
    const sorted = filtered.sort((a, b) => b.solves - a.solves);
    onFilter(sorted);
  });
</script>

{#snippet categoryBtn(category: string, solved: number, total: number)}
  {@const selected =
    (category === "All" && anyFilter) || categoryFilters[category]}
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
    <span class="flex-grow truncate">{category}</span>
    <span
      class="text-xs"
      class:text-blue-600={selected}
      class:text-gray-500={!selected}
    >
      {solved}/{total}
    </span>
  </button>
{/snippet}

<div class="flex flex-col gap-1 w-full p-2">
  <div class="px-2 pt-2 pb-1 text-xs font-bold text-gray-500">CATEGORIES</div>
  {@render categoryBtn("All", allSolveCount, allCount)}
  {#each categories as cat}
    {@const counts = getCategoryCounts(cat)}
    {@render categoryBtn(cat, counts.solved, counts.total)}
  {/each}
</div>
