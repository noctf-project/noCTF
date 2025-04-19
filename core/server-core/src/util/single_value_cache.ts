/**
 * A cache for a single value that expires after a specified time.
 * @template T The type of the cached value
 */
export class SingleValueCache<T> {
  private value: T | null = null;
  private lastUpdated: number | null = null;
  private fetchPromise: Promise<T> | null = null;

  /**
   * Creates a new single value cache.
   * @param expiryTimeMs The time in milliseconds after which the cached value expires
   * @param resolver A function that returns a Promise resolving to the value to cache
   * @param options Configuration options for the cache
   */
  constructor(
    private readonly resolver: () => Promise<T>,
    private readonly expiryTimeMs: number,
    private readonly allowStale = false,
  ) {}

  /**
   * Gets the cached value, fetching a new one if needed.
   * @returns A Promise resolving to the cached value
   */
  async get(): Promise<T> {
    if (this.value !== null && this.lastUpdated !== null) {
      const elapsed = performance.now() - this.lastUpdated;
      if (elapsed < this.expiryTimeMs) {
        return this.value;
      }
    }

    if (this.fetchPromise) {
      if (this.value === null || !this.allowStale) return this.fetchPromise;
      if (this.allowStale) return this.value;
    }

    this.fetchPromise = this.resolver();
    this.fetchPromise
      .then((newValue) => {
        this.value = newValue;
        this.lastUpdated = performance.now();
        this.fetchPromise = null;
        return newValue;
      })
      .catch(() => {
        this.fetchPromise = null;
      });
    if (this.value !== null && this.allowStale) {
      return this.value;
    }

    return this.fetchPromise;
  }

  /**
   * Returns the time-to-live in milliseconds for the current cached value.
   * @returns The TTL in milliseconds, or 0 if expired/no value
   */
  ttl(): number {
    if (this.value === null || this.lastUpdated === null) {
      return 0;
    }

    const elapsed = performance.now() - this.lastUpdated;
    return Math.max(0, this.expiryTimeMs - elapsed);
  }

  /**
   * Clears the cached value, forcing the next get() to fetch a new value.
   */
  clear(): void {
    this.value = null;
    this.lastUpdated = null;
    this.fetchPromise = null;
  }
}

export default SingleValueCache;
