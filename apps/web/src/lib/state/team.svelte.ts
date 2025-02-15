import client from "$lib/api/index.svelte";
import type { PathResponse } from "$lib/api/types";
import { LRUCache } from "lru-cache";

export type Team = PathResponse<"/team/id/{id}", "get">["data"];

export class TeamService {
  private readonly cache = new LRUCache<number, Team>({
    max: 4096,
    ttl: 900000, // 15 minutes
    fetchMethod: (id) => this.fetchTeamById(id),
  });

  async getTeamById(id: number) {
    return this.cache.fetch(id);
  }

  async getTeamName(id: number) {
    try {
      return (await this.cache.fetch(id))?.name;
    } catch {
      return "unknown";
    }
  }

  private async fetchTeamById(id: number): Promise<Team> {
    const { data, error } = await client.GET("/team/id/{id}", {
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
