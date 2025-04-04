import type { PathResponse } from "$lib/api/types";
import { SvelteMap } from "svelte/reactivity";
import api from "$lib/api/index.svelte";

export type TeamScoringData = PathResponse<
  "/scoreboard/teams/{id}",
  "get"
>["data"];

class TeamScoresState {
  loading = new SvelteMap<number, boolean>();
  data = new SvelteMap<number, TeamScoringData>();

  constructor() {}

  async fetchTeam(team: number) {
    this.loading.set(team, true);

    try {
      const { data: response, error } = await api.GET(
        "/scoreboard/teams/{id}",
        {
          params: { path: { id: team } },
        },
      );

      if (response) {
        this.data.set(team, response.data);
        this.loading.delete(team);
      } else {
        throw new Error(`Fetch returned error: ${error}`);
      }
    } catch (e) {
      console.error("Could not load data", e);
      this.loading.delete(team);
    }
  }

  loadTeams(teams: number[]) {
    for (const team of teams) {
      if (!this.loading.has(team) && !this.data.has(team)) {
        this.fetchTeam(team);
      }
    }
  }

  clearTeams() {
    this.data.clear();
    this.loading.clear();
  }
}

const teamScoresState = new TeamScoresState();
export default teamScoresState;
