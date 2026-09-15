import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import { SignalledWorker } from "./signalled.ts";
import { Logger } from "../types/primitives.ts";

describe(SignalledWorker, () => {
  const logger = mock<Logger>();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it("runs handler and shuts down gracefully on dispose", async () => {
    let runs = 0;
    const abortedStates: boolean[] = [];
    const worker: SignalledWorker = new SignalledWorker({
      name: "test-worker",
      logger,
      handler: async (signal) => {
        runs++;
        if (runs === 1) {
          abortedStates.push(signal.aborted);
          worker.dispose();
          abortedStates.push(signal.aborted);
        }
      },
    });

    const runPromise = worker.run();
    await vi.runAllTimersAsync();
    await runPromise;

    expect(runs).toBe(1);
    expect(abortedStates).toEqual([false, true]);
  });

  it("restarts worker handler on error with delay", async () => {
    let runs = 0;
    const worker: SignalledWorker = new SignalledWorker({
      name: "faulty-worker",
      logger,
      handler: async () => {
        runs++;
        if (runs === 1) {
          throw new Error("Temporary failure");
        }
        worker.dispose();
      },
    });

    const runPromise = worker.run();
    await vi.runAllTimersAsync();
    await runPromise;

    expect(runs).toBe(2);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ name: "faulty-worker" }),
      "Worker threw error, restarting",
    );
  });

  it("throws error if run is called while already running", async () => {
    const worker = new SignalledWorker({
      name: "already-running-worker",
      logger,
      handler: async (signal) => {
        while (!signal.aborted) {
          await new Promise((r) => setTimeout(r, 100));
        }
      },
    });

    const p = worker.run();
    await expect(worker.run()).rejects.toThrow("Worker is already running");
    worker.dispose();
    await vi.runAllTimersAsync();
    await p;
  });
});
