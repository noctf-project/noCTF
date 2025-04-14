import { LRUCache } from "lru-cache";
import client from "$lib/api/index.svelte";
import type { PathResponse } from "$lib/api/types";

const DEBOUNCE_INTERVAL = 64;
const MAXIMUM_QUERIES = 50;

export type Team = PathResponse<
  "/teams/query",
  "post"
>["data"]["teams"][number];

export class TeamQueryService {
  private queue: Set<number> = new Set();
  private resolveQueue: [number, (r: Team) => void, (r?: any) => void][] = [];
  private debounce: ReturnType<typeof setTimeout> | null = null;

  // Needed to use a sentinel value to represent not found, and also to stop
  // it from constantly spamming.
  private readonly cache = new LRUCache<number, Team | { _notfound: true }>({
    max: 8192,
    ttl: 900000, // 15 minutes
  });

  async get(id: number): Promise<Team | null> {
    const team = this.cache.get(id);
    if (team && !(team as { _notfound: true })._notfound) return team as Team;
    if (!this.debounce)
      this.debounce = setTimeout(() => this.fetch(), DEBOUNCE_INTERVAL);
    this.queue.add(id);
    const p = new Promise<Team | null>((resolve, reject) =>
      this.resolveQueue.push([id, resolve, reject]),
    );
    if (this.queue.size >= MAXIMUM_QUERIES) void this.fetch();
    return p;
  }

  private async fetch() {
    const ids = this.queue;
    const resolveQueue = this.resolveQueue;
    this.queue = new Set();
    this.resolveQueue = [];
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = null;

    try {
      const { data, error } = await client.POST("/teams/query", {
        body: {
          ids: [...ids],
        },
      });
      if (error) throw new Error(error?.message || JSON.stringify(error));
      if (data) {
        data.data.teams.forEach((t) => {
          this.cache.set(t.id, t);
          ids.delete(t.id);
        });
        // only cache negatives for 90 seconds
        ids.forEach((id) =>
          this.cache.set(id, { _notfound: true }, { ttl: 90000 }),
        );
      }
    } catch (e) {
      console.error("Error fetching team names", e);
    } finally {
      resolveQueue.forEach(([id, resolve, reject]) => {
        const team = this.cache.get(id);
        if (team && !(team as { _notfound: true })._notfound)
          return resolve(team as Team);
        reject(new Error("could not get team"));
      });
    }
  }
}
export default new TeamQueryService();
