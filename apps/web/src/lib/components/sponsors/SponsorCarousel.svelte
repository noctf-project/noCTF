<script module lang="ts">
  export interface SponsorCarousellProps {
    sponsors: SponsorDetails[];
  }
</script>

<script lang="ts">
  import { type SponsorDetails, type SponsorTier } from "$lib/api/types";
  import themeState from "$lib/state/theme.svelte";

  const { sponsors }: SponsorCarousellProps = $props();

  // map of each tier to the list of sponsors at that tier
  const sponsorsByTier = $derived(
    sponsors.reduce(
      (acc, sponsor) => {
        acc[sponsor.level] = [...(acc[sponsor.level] || []), sponsor];
        return acc;
      },
      {} as Record<SponsorTier, SponsorDetails[]>,
    ),
  );
</script>

{#snippet sponsorSlide(sponsor: SponsorDetails)}
  <div class="slide">
    <div class="logo">
      <a href={sponsor.url} target="_blank" title={sponsor.name}>
        <img
          alt={sponsor.name}
          src={themeState.currentTheme === "dark"
            ? sponsor.logo.dark
            : sponsor.logo.light}
        />
      </a>
    </div>
    <div class="sponsor-tier">
      <img
        alt={`${sponsor.level} sponsor banner`}
        src={`/images/sponsors/sponsor-tiers/${sponsor.level}-banner.webp`}
      />
    </div>
  </div>
{/snippet}

<div class="slide-container">
  <h2 class="text-center" style="margin-top: 0;  text-align: center;">
    <a class="text-xl hover:text-primary" href="/sponsors">Our Sponsors</a>
  </h2>
  <div class="flex items-center">
    <div class=" items-center hidden sm:flex">
      {#each sponsorsByTier.platinum as sponsor}
        {@render sponsorSlide(sponsor)}
      {/each}
    </div>
    <div class="slider">
      <div class="slide-track">
        <!-- This double up is intentional -->
        {#each [1, 2] as _}
          <div class="sm:hidden flex">
            {#each sponsorsByTier.platinum as sponsor}
              {@render sponsorSlide(sponsor)}
            {/each}
          </div>
          {#each sponsorsByTier.infra as sponsor}
            {@render sponsorSlide(sponsor)}
          {/each}
          <div class="spacer"></div>
          {#each sponsorsByTier.gold as sponsor}
            {@render sponsorSlide(sponsor)}
          {/each}
          <div class="spacer"></div>
          {#each sponsorsByTier.silver as sponsor}
            {@render sponsorSlide(sponsor)}
          {/each}
          <div class="spacer"></div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  $background: #171a1f;
  @mixin black-gradient {
    background: linear-gradient(
      to right,
      $background,
      rgba(255, 255, 255, 0) 100%
    );
  }
  // @use "$lib/styles/mixins" as *;

  $animationSpeed: 30s;
  $sponsorLogoWidth: 20vh;
  $sponsorLogoMargin: 30px;
  $spacerWidth: 3vw;
  $sliderWidth: 70vw;
  $numSpacers: 4;
  $numSponsors: 10;

  /* Animation */
  @keyframes scroll {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }

  .slide-container {
    overflow: hidden;
    // width: 100vw;
    // margin-top: auto;
  }

  /* Styling */
  .slider {
    margin: auto;
    overflow: hidden;
    position: relative;
    width: $sliderWidth;
    mask-image: linear-gradient(
      to right,
      transparent 0%,
      black 10%,
      black 90%,
      transparent 100%
    );

    .slide-track {
      animation: scroll $animationSpeed linear infinite;
      display: flex;
      align-items: center;
      width: max-content;
    }
  }
  .slide {
    text-align: center;
    width: $sponsorLogoWidth;
    margin-left: $sponsorLogoMargin;
    margin-right: $sponsorLogoMargin;

    .logo {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 10vh;

      img {
        max-height: 10vh;
        padding: 15px 0px;
        width: 100%;
      }
    }
  }

  .spacer {
    width: $spacerWidth;
  }

  @media screen and (max-width: 750px) and (orientation: portrait) {
    .slide-container {
      width: 100%;
    }
    .slider {
      mask-image: none;
      width: 100vw;
    }
  }
</style>
