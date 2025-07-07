<script lang="ts">
  import Icon from "@iconify/svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import {
    getDifficultyFromTags,
    getCategoriesFromTags,
    categoryToIcon,
  } from "$lib/utils/challenges";
  import DifficultyChip from "$lib/components/challenges/DifficultyChip.svelte";
  import { type Difficulty } from "$lib/constants/difficulties";

  const challenges = wrapLoadable(api.GET("/admin/challenges"));

  async function deleteChallenge(id: number, title: string) {
    if (!confirm(`Are you sure you want to delete "${title}"`)) {
      return;
    }

    const res = await api.DELETE("/admin/challenges/{id}", {
      params: {
        path: { id },
      },
    });

    if (res.error) {
      alert(res.error?.message || "Failed to delete challenge");
      return;
    }

    challenges.r!.data!.data = challenges.r!.data!.data.filter(
      (v) => v.id !== id,
    );
  }
</script>

<div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
  <div
    class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6"
  >
    <h1 class="text-2xl font-bold">Challenges</h1>
    <a
      href="/admin/challenges/new"
      class="btn btn-primary pop hover:pop"
      aria-label="New challenge"
    >
      <Icon icon="material-symbols:add" class="text-lg" />
      New Challenge
    </a>
  </div>

  {#if challenges.loading}
    <div class="flex flex-col items-center gap-4 mt-16">
      <div class="loading loading-spinner loading-lg text-primary"></div>
      <p class="text-center">Loading...</p>
    </div>
  {:else if challenges.error}
    <div class="alert alert-error pop">
      <Icon icon="material-symbols:error" />
      <span>Failed to load challenges</span>
    </div>
  {:else if challenges.r?.data?.data}
    <div class="overflow-x-auto pop rounded-lg">
      <table
        class="table table-sm table-fixed bg-base-100 w-full"
        aria-label="Challenge list"
      >
        <thead>
          <tr class="bg-base-300 border-b-2 border-base-400">
            <th
              scope="col"
              class="w-16 border-r-2 border-base-400 text-center font-semibold"
              >ID</th
            >
            <th
              scope="col"
              class="w-32 border-r-2 border-base-400 text-center font-semibold"
            >
              Difficulty
            </th>
            <th
              scope="col"
              class="w-32 border-r-2 border-base-400 text-center font-semibold"
            >
              Categories
            </th>
            <th
              scope="col"
              class="w-auto border-r-2 border-base-400 font-semibold">Title</th
            >
            <th
              scope="col"
              class="w-48 border-r-2 border-base-400 text-center font-semibold"
            >
              Visibility
            </th>
            <th scope="col" class="w-48 text-center font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each challenges.r.data.data as challenge}
            {@const difficulty = getDifficultyFromTags(challenge.tags)}
            {@const isVisible = challenge.hidden
              ? false
              : !challenge.visible_at ||
                Date.now() > new Date(challenge.visible_at).getTime()}
            {@const isHidden = challenge.hidden}
            <tr
              class="border border-r border-base-300 hover:bg-base-50 transition-colors"
            >
              <td class="border-r border-base-400 text-center font-mono text-sm"
                >{challenge.id}</td
              >
              <td class="border-r border-base-400 text-center">
                {#if difficulty}
                  <DifficultyChip difficulty={difficulty as Difficulty} />
                {:else}
                  <span class="text-base-content/60">None</span>
                {/if}
              </td>
              <td class="border-x border-base-400 text-center">
                {#if getCategoriesFromTags(challenge.tags).length > 0}
                  <div class="flex gap-1 flex-wrap justify-center">
                    {#each getCategoriesFromTags(challenge.tags) as cat}
                      <div class="tooltip" data-tip={cat}>
                        <Icon icon={categoryToIcon(cat)} class="text-lg" />
                      </div>
                    {/each}
                  </div>
                {:else}
                  <span class="text-base-content/60">None</span>
                {/if}
              </td>
              <td class="border-r border-base-400 font-semibold">
                <a
                  href="/admin/challenges/edit/{challenge.id}"
                  class="link link-primary hover:link-hover"
                >
                  {challenge.title}
                </a>
              </td>
              <td class="border-r border-base-400 text-center">
                <div class="flex flex-col items-center gap-1">
                  {#if isHidden}
                    <span class="badge badge-error badge-sm pop">Hidden</span>
                  {:else if isVisible}
                    <span class="badge badge-success badge-sm pop">Visible</span
                    >
                  {:else}
                    <span class="badge badge-warning badge-sm pop"
                      >Scheduled</span
                    >
                  {/if}
                  {#if challenge.visible_at && !isHidden}
                    <span class="text-xs text-base-content/60">
                      {new Date(challenge.visible_at).toLocaleString()}
                    </span>
                  {/if}
                </div>
              </td>
              <td class="text-center">
                <div class="flex gap-2 justify-center">
                  <a
                    href="/admin/challenges/edit/{challenge.id}"
                    class="btn btn-xs bg-base-100 pop hover:pop"
                    aria-label="Edit {challenge.title}"
                  >
                    <Icon icon="material-symbols:edit" class="text-sm" />
                    Edit
                  </a>
                  <button
                    onclick={() =>
                      deleteChallenge(challenge.id, challenge.title)}
                    class="btn btn-xs btn-error pop hover:pop"
                    aria-label="Delete {challenge.title}"
                  >
                    <Icon icon="material-symbols:delete" class="text-sm" />
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
