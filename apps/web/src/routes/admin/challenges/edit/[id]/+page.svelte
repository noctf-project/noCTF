<script lang="ts">
  import { page } from "$app/state";
  import ChallengeCreateEdit, {
    type ChallData,
    type Flag,
  } from "$lib/components/challenges/ChallengeCreateEdit.svelte";
  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import {
    getCategoriesFromTags,
    getDifficultyFromTags,
    getCustomTagsFromTags,
  } from "$lib/utils/challenges";
  import type { Difficulty } from "$lib/constants/difficulties";
  import { toasts } from "$lib/stores/toast";

  const challData = wrapLoadable(
    (async () => {
      const { data, error } = await api.GET("/admin/challenges/{id}", {
        params: {
          path: {
            id: page.params.id!.toString(),
          },
        },
      });

      if (error) {
        toasts.error(error.message || "An unknown error occurred");
        throw new Error("challenge not found");
      }
      const challenge = data.data;
      const filePromise = challenge.private_metadata.files.map(
        async ({ id }) => {
          const { data, error } = await api.GET("/admin/files/{id}", {
            params: {
              path: {
                id,
              },
            },
          });
          if (error) return null;
          return data.data;
        },
      );
      // TODO: show that there are invalid files
      return {
        challenge: data.data,
        files: (await Promise.all(filePromise)).filter(
          (v): v is Exclude<typeof v, null> => !!v,
        ),
      };
    })(),
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
  } = challData.r.challenge}
  {@const {
    solve: { flag },
    score,
  } = private_metadata}
  {@const editChallData: ChallData = {
    id, title, description,
    isHidden: hidden,
    visibleAt: visible_at ?? undefined,
    difficulty: getDifficultyFromTags(tags) as Difficulty | "",
    categories: getCategoriesFromTags(tags),
    customTags: getCustomTagsFromTags(tags),
    score,
    flags: flag as Flag[] ?? [],
    files: challData.r.files.map(({ id, filename }) => ({ id, filename, is_attachment: true })),
    version,
  }}
  <ChallengeCreateEdit mode="edit" challData={editChallData} />
{/if}
