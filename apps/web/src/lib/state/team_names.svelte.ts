import { LRUCache } from "lru-cache";
import client from "$lib/api/index.svelte";

const DEBOUNCE_INTERVAL = 64;
const MAXIMUM_QUERIES = 64;

export class TeamNamesService {
  private queue: Set<number> = new Set();
  private resolveQueue: [number, (r: string) => void, (r?: any) => void][] = [];
  private debounce: ReturnType<typeof setTimeout> | null = null;

  private readonly cache = new LRUCache<number, string>({
    max: 4096,
    ttl: 900000, // 15 minutes
  });

  async get(id: number) {
    const name = this.cache.get(id);
    if (name) return name;
    if (!this.debounce)
      this.debounce = setTimeout(() => this.fetch(), DEBOUNCE_INTERVAL);
    this.queue.add(id);
    const p = new Promise<string>((resolve, reject) =>
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
      const { data, error } = await client.GET("/team_names", {
        params: {
          query: { id: ids.values().toArray() },
        },
      });
      if (error) throw new Error(error);
      if (data) {
        data.data.forEach(({ id, name }) => {
          this.cache.set(id, name);
          ids.delete(id);
        });
        ids.forEach((id) => this.cache.set(id, "unknown team"));
      }
    } catch (e) {
      console.error("Error fetching team names", e);
    } finally {
      resolveQueue.forEach(([id, resolve, reject]) => {
        const name = this.cache.get(id);
        if (name) return resolve(name);
        reject(new Error("could not get team name"));
      });
    }
  }
}
export default new TeamNamesService();
