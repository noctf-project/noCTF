import { afterEach, describe, expect, it, vi } from "vitest";

import { RunInParallelWithLimit, Semaphore } from "./semaphore.ts";

describe(Semaphore, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("Happy path test", async () => {
    const sem = new Semaphore(1);
    await sem.acquire();
    await sem.release();
  });

  it("Cannot decrement semaphore below 0", async () => {
    const sem = new Semaphore(1);
    await expect(() => sem.release()).rejects.toThrowError();
  });

  it("Blocks on semaphore", async () => {
    const sem = new Semaphore(2);
    vi.useFakeTimers();
    setTimeout(() => {
      void sem.release();
      void sem.release();
    }, 500);
    await sem.acquire();
    await sem.acquire();
    vi.advanceTimersByTime(500);
    await sem.acquire();
    await sem.acquire();
    await sem.release();
    await sem.release();
    await sem.acquire();
    await sem.acquire(); // semaphore ends with full
  });

  it("signals on empty semaphore", async () => {
    const sem = new Semaphore(2);
    await sem.acquire();
    await sem.acquire();
    const Fn = vi.fn();
    const signal = sem.signal().then(Fn);
    await Promise.resolve();
    expect(Fn).not.toHaveBeenCalled();
    await sem.release();
    await sem.release();
    await signal;
    expect(Fn).toHaveBeenCalled();
  });

  it("signals on already empty semaphore", async () => {
    const sem = new Semaphore(2);
    await sem.signal();
  });
});

describe(RunInParallelWithLimit, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("Returns all results", async () => {
    const items = [1, 2, 3, 4];
    const results = await RunInParallelWithLimit(items, 2, async (x) => x * 2);
    const fulfilled = results
      .map((r) => r.status === "fulfilled" && r.value)
      .filter((r) => r);
    expect(fulfilled).toEqual([2, 4, 6, 8]);
  });

  it("Return errored and successful results", async () => {
    const items = [1, 2, 3, 4];
    const results = await RunInParallelWithLimit(items, 2, async (x) => {
      if (x % 2 === 0) {
        return x * 2;
      }
      throw new Error();
    });
    const fulfilled = results
      .map((r) => r.status === "fulfilled" && r.value)
      .filter((r) => r);
    expect(fulfilled).toEqual([4, 8]);
    const rejected = results
      .map((r) => r.status === "rejected" && r.reason)
      .filter((r) => r);
    expect(rejected).toEqual([new Error(), new Error()]);
  });
});
