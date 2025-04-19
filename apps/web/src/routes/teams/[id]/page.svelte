<script lang="ts">
  import Icon from "@iconify/svelte";
  import { countryCodeToFlag } from "$lib/utils/country_flags";
  import TeamQueryService from "$lib/state/team_query.svelte";
  import { wrapLoadable } from "$lib/api/index.svelte";

  export interface Props {
    teamId: number;
  }

  function getIfNotNullOrEmpty(
    str: string | undefined | null,
  ): string | undefined {
    if (str != null && str.length > 0) {
      return str;
    }
    return undefined;
  }

  function getCountryString(country: string | null) {
    const countryString = getIfNotNullOrEmpty(country);
    if (countryString == null) {
      return "🌍 Country unknown";
    }
    return `${countryCodeToFlag(countryString)} ${countryString}`;
  }

  function getMemberRoleString(role: "owner" | "member") {
    return role === "owner" ? "👑" : "👤";
  }

  function getBioString(bio: string | null) {
    const bioString = getIfNotNullOrEmpty(bio);
    if (bioString == null) {
      return "No bio yet";
    }
    return bioString;
  }

  let { teamId }: Props = $props();
  let teamLoader = wrapLoadable(TeamQueryService.get(teamId));
  let team = $derived(teamLoader.r);
</script>

{#if teamLoader.loading}
  <div class="flex flex-col items-center gap-4 mt-16">
    <div class="loading loading-spinner loading-lg text-primary"></div>
    <p class="text-center">Loading...</p>
  </div>
{:else if !teamLoader.loading && team != null}
  <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex flex-col gap-8">
      <div class="flex flex-col gap-4">
        <h1 class="text-4xl font-bold">{team.name}</h1>
        <div class="flex flex-col gap-1">
          <p class="text-lg">{getCountryString(team.country)}</p>
          <p class="text-lg italic">{getBioString(team.bio)}</p>
        </div>
      </div>
      <div class="flex flex-col gap-4">
        <h2 class="text-2xl font-bold">Members</h2>
        <div
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {#each team.members as member}
            <a
              href="/users/{member.user_id}"
              class="group relative bg-base-100 overflow-hidden rounded-xl border border-base-300 p-5 flex flex-col
                 hover:border-primary hover:shadow-md transition-all duration-200 pop hover:pop"
            >
              <div class="flex items-center justify-between mb-3">
                <h2
                  class="text-xl font-bold text-primary group-hover:underline decoration-2 underline-offset-2 truncate"
                  title={`${member.user_id} (${member.role})`}
                >
                  {member.user_id}
                </h2>
                <div class="flex-shrink-0 opacity-80" title="Country">
                  {getMemberRoleString(member.role)}
                </div>
              </div>
              <p class="text-sm text-base-content/70 mb-4 line-clamp-1 h-5">
                The bio goes here blah blah blah blah blah blah blah blah blah
                blah blah blah blah blah blah blah blah blah blah blah blah blah
                blah blah blah blah blah blah blah blah blah blah blah blah blah
                blah blah blah blah blah blah blah blah blah blah blah blah blah
                blah blah blah blah blah blah blah blah blah blah blah blah blah
                blah blah blah blah blah blah blah blah blah blah blah blah blah
                blah blah blah blah blah blah blah
              </p>
              <div
                class="mt-auto pt-3 border-t border-base-200 flex justify-between items-center"
              >
                <div class="flex flex-row items-center gap-1 font-bold text-xl">
                  <Icon icon="material-symbols:flag" class="text-3xl" />
                  5 million flags
                </div>
                <div class="flex flex-row items-center gap-1 font-bold text-xl">
                  <Icon
                    icon="material-symbols:stars-outline-rounded"
                    class="text-3xl"
                  />
                  500 million points
                </div>
              </div>
            </a>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}
