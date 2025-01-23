<script lang="ts">
  import type { ChallengeCardProps } from "./ChallengeCard.svelte";
  import { categoryToIcon } from "$lib/utils/challenges";
  import Icon from "@iconify/svelte";

  interface ChallengeFiltererProps {
    challenges: ChallengeCardProps[];
    onFilter: (filteredChallenges: ChallengeCardProps[]) => void;
  }

  let { challenges, onFilter }: ChallengeFiltererProps = $props();
  const allChallenges = challenges.slice();
  const allSolveCount = allChallenges.filter((c) => c.isSolved).length;
  const allCount = allChallenges.length;
  const categories = new Set(allChallenges.flatMap((c) => c.categories));

  let anyFilter = $state(true);
  const allFalse = Object.fromEntries(
    Array.from(categories).map((k) => [k, false]),
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
    onFilter(filtered);
  });
</script>

{#snippet categoryBtn(category: string, solved: number, total: number)}
  {@const btnClass =
    "btn btn-ghost font-bold border border-base-500 shadow-solid w-9/12 max-w-64 flex flex-row pl-2 gap-3 justify-start"}
  {@const selected =
    (category == "All" && anyFilter) || categoryFilters[category]}
  <button
    class={`${btnClass} ${selected ? "bg-primary text-primary-content" : "bg-base-100"}`}
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

<div class="flex flex-col gap-4">
  {@render categoryBtn("All", allSolveCount, allCount)}
  {#each categories as cat}
    {@const counts = getCategoryCounts(cat)}
    {@render categoryBtn(cat, counts.solved, counts.total)}
  {/each}
</div>
