<script lang="ts">
  import { countryCodeToFlag } from "$lib/utils/country_flags";
  import TeamService from "$lib/state/team.svelte";
  import { wrapLoadable } from "$lib/api/index.svelte";

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

  function getBioString(bio: string | null) {
    const bioString = getIfNotNullOrEmpty(bio);
    if (bioString == null) {
      return "No bio yet";
    }
    return bioString;
  }

  let { teamId } = $props<{ teamId: number }>();
  let teamLoader = wrapLoadable(TeamService.getTeamById(teamId));
  let team = $derived(teamLoader.r);
  $inspect(team);
</script>

{#if !teamLoader.loading && team != null}
  <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex flex-col gap-4">
      <h1 class="text-4xl font-bold">{team.name}</h1>
      <div class="flex flex-col gap-1">
        <p class="text-lg">{getCountryString(team.country)}</p>
        <p class="text-lg italic">{getBioString(team.bio)}</p>
      </div>
    </div>
  </div>
{/if}
