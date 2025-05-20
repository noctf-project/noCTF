import { LRUCache } from "lru-cache";
import client from "$lib/api/index.svelte";
import type { PathResponse } from "$lib/api/types";

const DEBOUNCE_INTERVAL = 64;
const MAXIMUM_QUERIES = 60;

export type User = PathResponse<
  "/users/query",
  "post"
>["data"]["entries"][number];

export class UserQueryService {
  private queue: Set<number> = new Set();
  private resolveQueue: [number, (r: User) => void, (r?: unknown) => void][] =
    [];
  private debounce: ReturnType<typeof setTimeout> | null = null;

  private readonly cache = new LRUCache<number, User | { _notfound: true }>({
    max: 8192,
    ttl: 900000, // 15 minutes
  });

  async get(id: number): Promise<User | null> {
    const user = this.cache.get(id);
    if (user && !(user as { _notfound: true })._notfound) return user as User;
    if (!this.debounce)
      this.debounce = setTimeout(() => this.fetch(), DEBOUNCE_INTERVAL);
    this.queue.add(id);
    const p = new Promise<User | null>((resolve, reject) =>
      this.resolveQueue.push([id, resolve, reject]),
    );
    if (this.queue.size >= MAXIMUM_QUERIES) void this.fetch();
    return p;
  }

  async queryUsers({
    page = 1,
    page_size = 60,
    name_prefix = undefined,
    division_id = undefined,
    ids = undefined,
  }: {
    page?: number;
    page_size?: number;
    name_prefix?: string;
    division_id?: number;
    ids?: number[];
  }): Promise<{ users: User[]; total: number }> {
    try {
      const { data, error } = await client.POST("/users/query", {
        body: {
          page,
          page_size,
          name_prefix,
          division_id,
          ids,
        },
      });

      if (error) throw new Error(error.message);

      data.data.entries.forEach((user) => {
        this.cache.set(user.id, user);
      });

      return { users: data.data.entries, total: data.data.total };
    } catch (e) {
      console.error("Error querying users:", e);
      throw e;
    }
  }

  private async fetch() {
    const ids = this.queue;
    const resolveQueue = this.resolveQueue;
    this.queue = new Set();
    this.resolveQueue = [];
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = null;

    try {
      const { data, error } = await client.POST("/users/query", {
        body: {
          ids: [...ids],
        },
      });
      if (error) throw new Error(error?.message || JSON.stringify(error));
      if (data) {
        data.data.entries.forEach((t) => {
          this.cache.set(t.id, t);
          ids.delete(t.id);
        });
        // only cache negatives for 90 seconds
        ids.forEach((id) =>
          this.cache.set(id, { _notfound: true }, { ttl: 90000 }),
        );
      }
    } catch (e) {
      console.error("Error fetching users", e);
    } finally {
      resolveQueue.forEach(([id, resolve, reject]) => {
        const user = this.cache.get(id);
        if (user && !(user as { _notfound: true })._notfound)
          return resolve(user as User);
        reject(new Error("could not get user"));
      });
    }
  }
}
export default new UserQueryService();
