import type { PathResponse } from "$lib/api/types";
import api from "$lib/api/index.svelte";
import { writable, get } from "svelte/store";

export type TeamScoringData = PathResponse<
  "/scoreboard/team/{id}",
  "get"
>["data"];

export const CreateTeamScoresStore = () => {
  const store = writable({
    loading: new Map<number, boolean>(),
    data: new Map<number, TeamScoringData>(),
  });

  const fetchTeam = async (team: number) => {
    store.update((s) => {
      s.loading.set(team, true);
      return s;
    });
    try {
      const { data, error } = await api.GET("/scoreboard/team/{id}", {
        params: { path: { id: team } },
      });
      if (data) {
        store.update((s) => {
          s.data.set(team, data.data);
          s.loading.delete(team);
          return s;
        });
      } else {
        throw new Error(`Fetch returned error: ${error}`);
      }
    } catch (e) {
      console.error("Could not load data", e);
      store.update((s) => {
        s.loading.delete(team);
        return s;
      });
    }
  };

  return {
    ...store,
    loadTeams: (teams: number[]) => {
      const d = get(store);
      for (const team of teams) {
        if (!d.loading.has(team) && !d.data.has(team)) fetchTeam(team);
      }
    },
    clearTeams: () =>
      store.set({
        data: new Map(),
        loading: new Map(),
      }),
  };
};

export const teamScoresStore = CreateTeamScoresStore();
