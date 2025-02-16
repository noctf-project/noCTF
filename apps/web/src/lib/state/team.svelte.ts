import client from "$lib/api/index.svelte";
import type { PathResponse } from "$lib/api/types";
import { LRUCache } from "lru-cache";

export type Team = PathResponse<"/teams/{id}", "get">["data"];

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

  async getTeamName(id: number) {
    await this.checkPreload();
    try {
      return (await this.cache.fetch(id))?.name;
    } catch {
      return "unknown";
    }
  }

  private async checkPreload() {
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
    const { data, error } = await client.GET("/teams", {});
    if (error) {
      throw new Error("Error fetching teams", { cause: error });
    }
    data.data.forEach((x) => {
      this.cache.set(x.id, x);
    });
  }

  private async fetchTeamById(id: number): Promise<Team> {
    const { data, error } = await client.GET("/teams/{id}", {
      params: {
        path: { id },
      },
    });
    if (error) {
      throw new Error("Error fetching team", { cause: error });
    }
    return data.data;
  }
}

export default new TeamService();
