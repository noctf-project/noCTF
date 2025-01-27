<script lang="ts">
  import { page } from "$app/state";
  import ChallengeCreateEdit, {
    type ChallData,
  } from "$lib/components/challenges/ChallengeCreateEdit.svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import {
    getCategoriesFromTags,
    getDifficultyFromTags,
    type Difficulty,
  } from "$lib/utils/challenges";

  const challData = wrapLoadable(
    api.GET("/admin/challenges/{id}", {
      params: {
        path: {
          id: Number(page.params.id),
        },
      },
    }),
  );
</script>

{#if challData.loading}
  <div class="flex flex-col items-center gap-4 mt-16">
    <div class="loading loading-spinner loading-lg text-primary"></div>
    <p class="text-center">Loading challenge data...</p>
  </div>
{:else}
  {@const {
    id,
    title,
    description,
    hidden,
    visible_at,
    tags,
    private_metadata,
    version,
  } = challData.r.data!.data}
  {@const {
    solve: { flag },
    score,
    files,
  } = private_metadata}
  {@const editChallData: ChallData = {
    id, title, description,
    isHidden: hidden,
    visibleAt: visible_at ?? undefined,
    difficulty: getDifficultyFromTags(tags) as Difficulty | "",
    categories: getCategoriesFromTags(tags),
    score,
    flags: flag?.map((f) => ({ type: f.strategy as "static"|"regex", value: f.data })) ?? [],
    files: Object.keys(files).map((filename) => ({ filename, ref: files[filename]!.ref })),
    version,
  }}
  <ChallengeCreateEdit mode="edit" challData={editChallData} />
{/if}
