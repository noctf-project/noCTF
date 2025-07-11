<script lang="ts">
  import { onMount } from "svelte";
  import configState from "$lib/state/config.svelte";
  import authState from "$lib/state/auth.svelte";

  let currentTime = $state(Date.now() / 1000);
  let timeInterval: ReturnType<typeof setInterval>;

  onMount(() => {
    timeInterval = setInterval(() => {
      currentTime = Date.now() / 1000;
    }, 1000);

    return () => {
      if (timeInterval) clearInterval(timeInterval);
    };
  });

  const formatTimeRemaining = (targetTime: number): string => {
    const diff = targetTime - currentTime;
    if (diff <= 0) return "00:00:00:00";

    const days = Math.floor(diff / (60 * 60 * 24));
    const hours = Math.floor((diff % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((diff % (60 * 60)) / 60);
    const seconds = Math.floor(diff % 60);

    return `${days.toString().padStart(2, "0")}:${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const getCountdownInfo = () => {
    const startTime = configState.siteConfig?.start_time_s;
    const endTime = configState.siteConfig?.end_time_s;

    if (!startTime && !endTime) return null;

    if (startTime && currentTime < startTime) {
      return {
        label: "Starts In",
        timeRemaining: formatTimeRemaining(startTime),
      };
    } else if (endTime && currentTime < endTime) {
      return {
        label: "Ends In",
        timeRemaining: formatTimeRemaining(endTime),
      };
    } else if (endTime && currentTime >= endTime) {
      return {
        label: "Thanks for playing!",
        timeRemaining: undefined,
      };
    }

    return null;
  };

  const countdownInfo = $derived(getCountdownInfo());
</script>

<div class="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-4">
  <div class="flex justify-center items-center">
    <img
      src="/images/DUCTF6-banner.webp"
      style="border-radius: 10%"
      alt="DUCTF6"
      class="w-full max-w-xl"
    />
  </div>

  {#if countdownInfo}
    <div class="text-center">
      <h2 class="text-xl lg:text-2xl font-bold mb-4">{countdownInfo.label}</h2>
      {#if countdownInfo.timeRemaining !== undefined}
        <div class="text-4xl lg:text-6xl font-mono font-bold">
          {countdownInfo.timeRemaining}
        </div>
      {/if}
    </div>
  {/if}

  <div class="flex justify-center">
    {#if authState.isAuthenticated && currentTime >= (configState?.siteConfig?.start_time_s || 0) && currentTime < (configState?.siteConfig?.end_time_s || 0)}
      <a href="/challenges" class="btn btn-primary btn-lg px-8 pop hover:pop">
        Play Now
      </a>
    {:else if authState.isAuthenticated && configState?.siteConfig?.end_time_s && currentTime >= configState?.siteConfig?.end_time_s}
      <!-- TODO: certificate link -->
      <!-- <a href="/certificate" class="btn btn-primary btn-lg px-8 pop hover:pop"> -->
      <!--   Get Your Certificate -->
      <!-- </a> -->
    {:else if !authState.isAuthenticated}
      <a href="/auth" class="btn btn-primary btn-lg px-8 pop hover:pop">
        Register Now
      </a>
    {/if}
  </div>
</div>
