<script lang="ts">
  import type { ChallengeCardData } from "./ChallengeCard.svelte";
  import { categoryToIcon, categoryOrdering } from "$lib/utils/challenges";
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
    new Set(
      allChallenges.map((c) => c.categories[0]).toSorted(categoryOrdering),
    ),
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
    const chals = allChallenges.filter(
      (c) => c.categories.indexOf(category) === 0,
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
  {@const btnClass =
    "btn btn-ghost font-bold hover:pop pop w-9/12 max-w-64 flex flex-row pl-2 gap-3 justify-start"}
  {@const selected =
    (category == "All" && anyFilter) || categoryFilters[category]}
  <button
    class={`${btnClass} ${selected ? "bg-primary text-primary-content hover:bg-primary" : "bg-base-100"}`}
    onclick={() => setFilter(category)}
  >
    <Icon icon={categoryToIcon(category)} height="70%" class="w-auto" />
    <div>{category}</div>
    <div class="flex-grow"></div>
    <div class={selected ? "text-gray-200" : "text-gray-500"}>
      {solved}/{total}
    </div>
  </button>
{/snippet}

<div class="flex flex-row flex-wrap justify-center md:flex-col gap-4">
  {@render categoryBtn("All", allSolveCount, allCount)}
  {#each categories as cat}
    {@const counts = getCategoryCounts(cat)}
    {@render categoryBtn(cat, counts.solved, counts.total)}
  {/each}
</div>
