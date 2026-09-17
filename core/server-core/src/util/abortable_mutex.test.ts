import { describe, expect, it } from "vitest";
import { AbortableMutex } from "./abortable_mutex.ts";

describe(AbortableMutex, () => {
  it("removes an aborted queued acquisition", async () => {
    const mutex = new AbortableMutex();
    const holder = new AbortController();
    const waiter = new AbortController();

    expect(await mutex.acquire(holder.signal)).toBe(true);
    const queued = mutex.acquire(waiter.signal);
    waiter.abort();
    await expect(queued).resolves.toBe(false);

    mutex.release();
    expect(await mutex.acquire(new AbortController().signal)).toBe(true);
    mutex.release();
  });

  it("waits for the active holder to release", async () => {
    const mutex = new AbortableMutex();
    expect(await mutex.acquire(new AbortController().signal)).toBe(true);

    let idle = false;
    const waitForIdle = mutex.idle().then(() => {
      idle = true;
    });
    await Promise.resolve();
    expect(idle).toBe(false);

    mutex.release();
    await waitForIdle;
    expect(idle).toBe(true);
  });
});
