import client from "$lib/api/index.svelte";
import type { PathResponse } from "$lib/api/types";
import { LRUCache } from "lru-cache";

export type Team = PathResponse<"/teams/query", "post">["data"]["teams"][number];

// TODO: this can probably get deprecated
export class TeamService {
  private isLoaded = false;
  private loadLock: Promise<void> | null = null;
  private readonly cache = new LRUCache<number, Team>({
    max: 4096,
    ttl: 900000, // 15 minutes
    fetchMethod: (id) => this.fetchTeamById(id),
  });

  async getTeamById(id: number) {
    await this.checkPreload();
    return this.cache.fetch(id);
  }

  async getAllTeams(): Promise<Team[]> {
    await this.preloadAll();
    return Array.from(this.cache.values()).toSorted((a, b) => a.id - b.id);
  }

  async checkPreload() {
    if (!this.isLoaded) {
      this.isLoaded = true;
      this.loadLock = this.preloadAll();
    }
    if (this.loadLock) {
      try {
        await this.loadLock;
      } catch (e) {
        console.error("Could not preload teams", e);
      } finally {
        this.loadLock = null;
      }
    }
  }

  private async preloadAll() {
    const { data, error } = await client.POST("/teams/query", {body: {}});
    if (error) {
      throw new Error("Error fetching teams", { cause: error });
    }
    // TODO: we can get rid of this whole class
    // patching this now to load the first 100 teams
    data.data.teams.forEach((x) => {
      this.cache.set(x.id, x);
    });
  }

  private async fetchTeamById(id: number): Promise<Team> {
    const { data, error } = await client.POST("/teams/query", {
      body: { ids: [id] },
    });
    if (error) {
      throw new Error("Error fetching team", { cause: error });
    }
    if (!data.data.teams[0]) throw new Error("Team not found");
    return data.data.teams[0];
  }
}

export default new TeamService();
