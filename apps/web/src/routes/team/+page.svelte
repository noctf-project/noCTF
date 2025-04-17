<script lang="ts">
  import Icon from "@iconify/svelte";
  import api from "$lib/api/index.svelte";
  import { toasts } from "$lib/stores/toast";
  import { copyToClipboard } from "$lib/utils/clipboard";
  import authState from "$lib/state/auth.svelte";

  let teamCode = $state("");
  let teamName = $state("");
  let isJoining = $state(false);
  let isCreating = $state(false);

  let pageState = $state<"form" | "success" | "joined" | "loading">("loading");
  let createdTeam = $state<{
    id: number;
    name: string;
    join_code: string;
  } | null>(null);

  let joinedTeam = $state<{
    id: number;
    name: string;
  } | null>(null);

  $effect(() => {
    if (authState.user && authState.user?.team_id) {
      window.location.href = `/teams/${authState.user.team_id}`;
    } else {
      setTimeout(() => (pageState = "form"), 250);
    }
  });

  async function handleJoinTeam() {
    if (!teamCode.trim()) {
      toasts.error("Please enter a team join code");
      return;
    }

    try {
      isJoining = true;
      const response = await api.POST("/team/join", {
        body: {
          join_code: teamCode,
        },
      });

      if (response.data) {
        const team = response.data.data;
        joinedTeam = {
          id: team.id,
          name: team.name,
        };
        toasts.success(`Successfully joined team: ${team.name}`);
        pageState = "joined";
      } else if (response.error) {
        toasts.error(response.error.message || "Failed to join team");
      }
    } catch (e) {
      console.error("Failed to join team:", e);
      toasts.error(
        "Failed to join team. Please check your team join code and try again.",
      );
    } finally {
      isJoining = false;
    }
  }

  async function handleCreateTeam() {
    if (!teamName.trim()) {
      toasts.error("Please enter a team name");
      return;
    }

    try {
      isCreating = true;

      const siteConfig = await api.GET("/site/config");
      const defaultDivisionId = siteConfig.data?.data.default_division_id ?? 1;

      if (!defaultDivisionId) {
        throw new Error("Could not determine default division");
      }

      const response = await api.POST("/teams", {
        body: {
          name: teamName,
          division_id: defaultDivisionId,
        },
      });

      if (response.data) {
        const team = response.data.data;
        createdTeam = {
          id: team.id,
          name: team.name,
          join_code: team.join_code || "",
        };
        toasts.success(`Team "${team.name}" created successfully!`);
        setTimeout(() => {
          pageState = "success";
        }, 300);
      } else if (response.error) {
        toasts.error(response.error.message || "Failed to create team");
      }
    } catch (e) {
      console.error("Failed to create team:", e);
      toasts.error("Failed to create team. Please try again later.");
    } finally {
      isCreating = false;
    }
  }

  function handleCopyJoinCode() {
    if (createdTeam?.join_code) {
      copyToClipboard(createdTeam.join_code);
      toasts.success("Team join code copied to clipboard!");
    }
  }
</script>

<div class="w-full mx-auto px-4 sm:px-6 lg:px-8 h-auto mt-8">
  <div class="text-center text-4xl font-black pb-4">Join or create a team</div>

  {#if pageState === "loading"}
    <div class="flex flex-col items-center gap-4 mt-16">
      <div class="loading loading-spinner loading-lg text-primary"></div>
      <p class="text-center">Loading...</p>
    </div>
  {:else if pageState === "form"}
    <div class="flex sm:flex-row flex-col gap-6 mt-16 w-full justify-center">
      <div class="card pop bg-base-100 h-80 w-full xl:w-3/12">
        <div class="card-body items-center text-center">
          <Icon icon="mdi:account-group" class="text-4xl text-primary mb-1" />
          <h1 class="card-title">Join Team</h1>
          <div class="form-control w-full mt-4">
            <label class="label" for="team-code">
              <span class="label-text">Team join code</span>
            </label>
            <input
              id="team-code"
              bind:value={teamCode}
              type="text"
              placeholder="Enter team join code"
              required
              class="w-full input input-bordered focus:outline-none focus:ring-0 focus:ring-offset-0"
            />
          </div>
          <div class="card-actions mt-2 w-full">
            <button
              class="btn btn-primary w-full pop hover:pop"
              onclick={handleJoinTeam}
              disabled={isJoining}
            >
              {#if isJoining}
                <span class="loading loading-spinner loading-sm"></span>
                Joining...
              {:else}
                Join
              {/if}
            </button>
          </div>
        </div>
      </div>

      <div class="divider sm:divider-horizontal sm:h-80 sm:mx-2">OR</div>

      <div class="card pop bg-base-100 h-80 w-full xl:w-3/12">
        <div class="card-body items-center">
          <Icon icon="mdi:plus-circle" class="text-4xl text-primary mb-1" />
          <h1 class="card-title">Create Team</h1>
          <div class="form-control w-full mt-4">
            <label class="label" for="team-name">
              <span class="label-text">Team name</span>
            </label>
            <input
              id="team-name"
              bind:value={teamName}
              type="text"
              placeholder="Enter team name"
              required
              class="w-full input input-bordered focus:outline-none focus:ring-0 focus:ring-offset-0"
            />
          </div>
          <div class="card-actions mt-2 w-full">
            <button
              class="btn btn-primary w-full pop hover:pop"
              onclick={handleCreateTeam}
              disabled={isCreating}
            >
              {#if isCreating}
                <span class="loading loading-spinner loading-sm"></span>
                Creating...
              {:else}
                Create
              {/if}
            </button>
          </div>
        </div>
      </div>
    </div>
  {:else if pageState === "success" && createdTeam}
    <div class="flex flex-col items-center mt-16 w-full">
      <div class="card pop bg-base-100 w-full max-w-lg">
        <div class="card-body items-center text-center">
          <Icon icon="mdi:check-circle" class="text-5xl text-primary mb-2" />
          <h1 class="card-title text-2xl">Team Created!</h1>
          <p class="py-2">
            Your team <span class="font-bold">{createdTeam.name}</span> has been
            created successfully.
          </p>

          <div class="w-full mt-4">
            <label class="label" for="team-code">
              <span class="label-text">Team join code:</span>
            </label>
            <div class="flex gap-2">
              <input
                id="team-code"
                type="text"
                value={createdTeam.join_code}
                class="input input-bordered w-full font-mono text-sm"
                readonly
              />
              <button onclick={handleCopyJoinCode} class="btn btn-square">
                <Icon icon="mdi:content-copy" class="text-xl" />
              </button>
            </div>
            <p class="text-sm text-neutral-500 mt-4">
              Share this code with your teammates so they can join your team.
              You can also find it in your team page.
            </p>
          </div>

          <div class="card-actions mt-6 w-full">
            <a href="/challenges" class="btn btn-primary w-full pop hover:pop">
              Go to Challenges
            </a>
          </div>
        </div>
      </div>
    </div>
  {:else if pageState === "joined" && joinedTeam}
    <div class="flex flex-col items-center mt-16 w-full">
      <div class="card pop bg-base-100 w-full max-w-md">
        <div class="card-body items-center text-center">
          <Icon icon="mdi:check-circle" class="text-5xl text-primary mb-2" />
          <h1 class="card-title text-2xl">Team Joined!</h1>
          <p class="py-4">
            You have successfully joined <span class="font-bold"
              >{joinedTeam.name}</span
            >.
          </p>

          <div class="card-actions mt-6 w-full">
            <a href="/challenges" class="btn btn-primary w-full pop hover:pop">
              Go to Challenges
            </a>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
