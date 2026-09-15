import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import { SingletonWorker } from "./singleton.ts";
import { LockService, LockServiceError } from "../services/lock.ts";
import { Logger } from "../types/primitives.ts";

describe(SingletonWorker, () => {
  const logger = mock<Logger>();
  const lockService = mock<LockService>();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it("acquires lease, executes handler, and shuts down on dispose", async () => {
    let handlerCalled = false;
    let leaseName: string | undefined;
    let handlerSignalAborted: boolean | undefined;

    lockService.withLease.mockImplementation(async (name, callback) => {
      leaseName = name;
      const leaseController = new AbortController();
      await callback(leaseController.signal);
    });

    const worker: SingletonWorker = new SingletonWorker({
      name: "test-singleton",
      logger,
      lockService,
      intervalSeconds: 10,
      handler: async (signal) => {
        handlerCalled = true;
        handlerSignalAborted = signal.aborted;
        worker.dispose();
      },
    });

    const runPromise = worker.run();
    await vi.runAllTimersAsync();
    await runPromise;

    expect(handlerCalled).toBe(true);
    expect(leaseName).toBe("worker:singleton:test-singleton");
    expect(handlerSignalAborted).toBe(false);
    expect(lockService.withLease).toHaveBeenCalledTimes(1);
  });

  it("handles LockServiceError gracefully by retrying after delay", async () => {
    let attempts = 0;

    const worker: SingletonWorker = new SingletonWorker({
      name: "retry-singleton",
      logger,
      lockService,
      intervalSeconds: 5,
      handler: async () => {},
    });

    lockService.withLease.mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        throw new LockServiceError("Failed to acquire lease");
      }
      worker.dispose();
    });

    const runPromise = worker.run();
    await vi.runAllTimersAsync();
    await runPromise;

    expect(attempts).toBe(2);
    // LockServiceError should not be logged as unexpected error
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs error and delays when unexpected error is thrown", async () => {
    let attempts = 0;

    const worker: SingletonWorker = new SingletonWorker({
      name: "crash-singleton",
      logger,
      lockService,
      intervalSeconds: 5,
      handler: async () => {},
    });

    lockService.withLease.mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error("Unexpected crash");
      }
      worker.dispose();
    });

    const runPromise = worker.run();
    await vi.runAllTimersAsync();
    await runPromise;

    expect(attempts).toBe(2);
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(Error),
      "Error encountered while processing handler",
    );
  });
});
