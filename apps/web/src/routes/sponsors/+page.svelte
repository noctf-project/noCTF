<script lang="ts">
  import { type SponsorDetails } from "$lib/api/types";
  import { sponsors } from "$lib/constants/sponsors";
  import Icon from "@iconify/svelte";
  import { slide } from "svelte/transition";
  import themeState from "$lib/state/theme.svelte";

  const platinumSponsor = sponsors.find(
    (sponsor) => sponsor.level === "platinum",
  );
  const goldSponsors = sponsors.filter((sponsor) => sponsor.level === "gold");
  const infrastructureSponsors = sponsors.filter(
    (sponsor) => sponsor.level === "infra",
  );
  const silverSponsors = sponsors.filter(
    (sponsor) => sponsor.level === "silver",
  );

  // Track collapsed state for each sponsor
  let collapsedStates = $state<Record<string, boolean>>({});

  // Initialize default states: all sponsors open by default
  $effect(() => {
    sponsors.forEach((sponsor) => {
      if (sponsor.description) {
        collapsedStates[sponsor.name] = false; // Open by default
      }
    });
  });

  function toggleDescription(sponsorName: string) {
    collapsedStates[sponsorName] = !collapsedStates[sponsorName];
  }
</script>

{#snippet singleSponsor(sponsor: SponsorDetails, size: "small" | "large")}
  <div
    class={`flex flex-col items-center ${size === "large" ? "w-full xl:w-1/2" : "sm:w-96 w-full"}`}
  >
    <div
      class={`${size === "large" ? "h-36" : "h-24"} flex flex-col items-center justify-center w-full`}
    >
      <a href={sponsor.url} target="_blank">
        <img
          src={themeState.currentTheme === "dark"
            ? sponsor.logo.dark
            : sponsor.logo.light}
          alt={`${sponsor.name} Sponsor`}
          class={`${size === "large" ? "max-w-96" : "max-w-48 max-h-24"} w-full`}
        />
      </a>
    </div>
    {#if sponsor.description}
      <div class="flex flex-col w-full mt-4">
        <button
          class="btn btn-ghost btn-sm w-full justify-between pop hover:pop"
          onclick={() => toggleDescription(sponsor.name)}
        >
          <span class="text-sm font-medium">Info</span>
          <Icon
            icon={collapsedStates[sponsor.name]
              ? "mdi:chevron-down"
              : "mdi:chevron-up"}
            class="text-lg transition-transform duration-200"
          />
        </button>
        {#if !collapsedStates[sponsor.name]}
          <div
            class="mt-2 p-3 bg-base-200 rounded-lg"
            transition:slide={{ duration: 200 }}
          >
            <p class="whitespace-pre-line text-sm">
              {sponsor.description.text}
            </p>
            {#if sponsor.description.links}
              <div class="mt-2 space-y-1">
                {#each sponsor.description.links as link}
                  <a
                    href={link}
                    target="_blank"
                    class="text-blue-500 hover:text-blue-600 text-sm block break-all"
                  >
                    {link}
                  </a>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

<div class="flex flex-col items-center h-screen p-2">
  <div
    class="flex flex-col items-center w-full md:w-8/12 bg-base-100 p-4 rounded-lg opacity-95"
  >
    <!-- Platinum Sponsor -->
    <div class="flex flex-col items-center pb-10 w-full">
      <h1 class="text-4xl font-bold">Platinum Sponsor</h1>

      {#if platinumSponsor}
        {@render singleSponsor(platinumSponsor, "large")}
      {/if}
    </div>

    <!-- infrastructure sponsors -->
    <div class="flex flex-col items-center pb-10 w-full">
      <h1 class="text-4xl font-bold">Infrastructure Sponsor</h1>
      {#each infrastructureSponsors as sponsor}
        {@render singleSponsor(sponsor, "large")}
      {/each}
    </div>

    <!-- Gold Sponsors -->
    <div class="flex flex-col items-center pb-10 w-full">
      <h1 class="text-4xl font-bold">Gold Sponsors</h1>
      <div class="flex flex-wrap gap-4 justify-center">
        {#each goldSponsors as sponsor}
          {@render singleSponsor(sponsor, "small")}
        {/each}
      </div>
    </div>

    <!-- Silver Sponsors -->
    <div class="flex flex-col items-center pb-10">
      <h1 class="text-4xl font-bold">Silver Sponsors</h1>
      <div class="flex flex-wrap gap-10 justify-center">
        {#each silverSponsors as sponsor}
          {@render singleSponsor(sponsor, "small")}
        {/each}
      </div>
    </div>
  </div>
</div>
