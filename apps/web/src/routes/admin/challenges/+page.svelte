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
  import Table from "$lib/components/Table.svelte";
  import TableRow from "$lib/components/TableRow.svelte";
  import TableCell from "$lib/components/TableCell.svelte";

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

  const columns = [
    { header: "ID", width: "3rem", align: "center" as const },
    { header: "Difficulty", width: "8rem", align: "center" as const },
    { header: "Categories", width: "6rem", align: "center" as const },
    { header: "Title", align: "left" as const },
    { header: "Visibility", width: "12rem", align: "center" as const },
    { header: "Actions", width: "8rem", align: "center" as const },
  ];

  function getDifficultyBgColor(
    difficulty: string | undefined,
  ): string | undefined {
    if (!difficulty) return undefined;
    return difficultyToBgColour(difficulty as Difficulty);
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
    <Table ariaLabel="Challenge list" {columns}>
      {#each challenges.r.data!.data as challenge}
        {@const difficulty = getDifficultyFromTags(challenge.tags)}
        {@const isVisible = challenge.hidden
          ? false
          : !challenge.visible_at ||
            Date.now() > new Date(challenge.visible_at).getTime()}
        {@const isHidden = challenge.hidden}
        <TableRow>
          <TableCell align="center" width="3rem">
            <p>{challenge.id}</p>
          </TableCell>
          <TableCell
            align="center"
            width="8rem"
            class_={getDifficultyBgColor(difficulty)}
          >
            <p>{difficulty}</p>
          </TableCell>
          <TableCell align="center" width="6rem">
            <div class="flex gap-2 justify-center">
              {#each getCategoriesFromTags(challenge.tags) as cat}
                <div class="tooltip" data-tip={cat}>
                  <Icon icon={categoryToIcon(cat)} class="text-xl" />
                </div>
              {/each}
            </div>
          </TableCell>
          <TableCell expand>
            <p>{challenge.title}</p>
          </TableCell>
          <TableCell
            align="center"
            width="12rem"
            bgColor={isHidden ? "error" : isVisible ? "primary" : "warning"}
          >
            <p>
              {isHidden
                ? "Hidden"
                : isVisible
                  ? "Visible"
                  : "Visible at " +
                    new Date(challenge.visible_at!).toLocaleString()}
            </p>
          </TableCell>
          <TableCell align="center" width="8rem">
            <div class="flex gap-2 justify-center">
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
            </div>
          </TableCell>
        </TableRow>
      {/each}
    </Table>
  {/if}
</div>
