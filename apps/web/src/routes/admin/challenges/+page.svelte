<script lang="ts">
  import Icon from "@iconify/svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import {
    getDifficultyFromTags,
    getCategoriesFromTags,
    categoryToIcon,
    difficultyToBgColour,
  } from "$lib/utils/challenges";
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
      // @ts-expect-error openapi-fetch
      alert(res.error);
      return;
    }

    challenges.r!.data!.data = challenges.r!.data!.data.filter(
      (v) => v.id !== id,
    );
  }
</script>

<div class="container mx-auto p-6">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-4xl font-bold">Challenges</h1>
    <a
      href="/admin/challenges/new"
      class="btn btn-primary pop"
      aria-label="New challenge"
    >
      <Icon icon="material-symbols:add-circle-rounded" class="text-xl" />
      New Challenge
    </a>
  </div>

  {#if challenges.loading}
    <div>Loading...</div>
  {:else}
    <div class="overflow-x-auto pop rounded-lg">
      <table
        class="table table-sm table-fixed bg-base-100 w-full"
        aria-label="Challenge list"
      >
        <thead>
          <tr class="bg-base-300 border-b-2 border-base-400">
            <th scope="col" class="w-10 border-r-2 border-base-400 text-center"
              >ID</th
            >
            <th scope="col" class="w-24 border-r-2 border-base-400 text-center">
              Difficulty
            </th>
            <th scope="col" class="w-32 border-r-2 border-base-400 text-center">
              Categories
            </th>
            <th scope="col" class="w-auto border-r-2 border-base-400">Title</th>
            <th scope="col" class="w-60 border-r-2 border-base-400 text-center">
              Visibility
            </th>
            <th scope="col" class="w-32 text-center pr-8">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each challenges.r.data!.data as challenge}
            {@const difficulty = getDifficultyFromTags(challenge.tags)}
            {@const isVisible = challenge.hidden
              ? false
              : !challenge.visible_at ||
                Date.now() > new Date(challenge.visible_at).getTime()}
            {@const isHidden = challenge.hidden}
            <tr class="border border-r border-base-300">
              <td class="border-r border-base-400 text-center"
                >{challenge.id}</td
              >
              <td
                class={"border-r border-base-400 text-center " + difficulty
                  ? difficultyToBgColour(difficulty as Difficulty)
                  : ""}>{difficulty}</td
              >
              <td class="border-x border-base-400 align-bottom text-center">
                {#each getCategoriesFromTags(challenge.tags) as cat}
                  <div class="tooltip" data-tip={cat}>
                    <Icon icon={categoryToIcon(cat)} class="text-xl" />
                  </div>
                {/each}
              </td>
              <td class="border-r border-base-400">{challenge.title}</td>
              <td
                class={"border-r border-base-400 text-center " +
                  (isHidden
                    ? "bg-error text-error-content"
                    : isVisible
                      ? "bg-primary text-primary-content"
                      : "bg-warning text-warning-content")}
                >{isHidden
                  ? "Hidden"
                  : isVisible
                    ? "Visible"
                    : "Visible at " +
                      new Date(challenge.visible_at!).toLocaleString()}</td
              >
              <td class="text-center">
                <a
                  href="/admin/challenges/edit/{challenge.id}"
                  class="btn btn-sm btn-ghost"
                  aria-label="Edit {challenge.title}"
                >
                  <Icon icon="material-symbols:edit-rounded" class="text-xl" />
                </a>
                <button
                  onclick={() => deleteChallenge(challenge.id, challenge.title)}
                  class="btn btn-sm btn-ghost"
                  aria-label="Delete {challenge.title}"
                >
                  <Icon
                    icon="material-symbols:delete-rounded"
                    class="text-xl text-error/90"
                  />
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
