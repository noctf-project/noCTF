import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import { WorkerRegistry } from "./registry.ts";
import { BaseWorker } from "./types.ts";
import { Logger } from "../types/primitives.ts";

describe(WorkerRegistry, () => {
  const logger = mock<Logger>();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it("runs registered workers and disposes them all gracefully", async () => {
    const worker1 = mock<BaseWorker>();
    const worker2 = mock<BaseWorker>();

    let finishWorker1: () => void;
    let finishWorker2: () => void;

    worker1.run.mockReturnValue(
      new Promise<void>((resolve) => {
        finishWorker1 = resolve;
      }),
    );
    worker2.run.mockReturnValue(
      new Promise<void>((resolve) => {
        finishWorker2 = resolve;
      }),
    );

    worker1.dispose.mockImplementation(() => {
      finishWorker1();
    });
    worker2.dispose.mockImplementation(() => {
      finishWorker2();
    });

    const registry = new WorkerRegistry(logger, 5000);
    registry.register(worker1);
    registry.register(worker2);

    const runPromise = registry.run();

    expect(worker1.run).toHaveBeenCalledTimes(1);
    expect(worker2.run).toHaveBeenCalledTimes(1);

    registry.dispose();

    expect(worker1.dispose).toHaveBeenCalledTimes(1);
    expect(worker2.dispose).toHaveBeenCalledTimes(1);

    await vi.runAllTimersAsync();
    await runPromise;
  });

  it("rejects run() if worker fails to shut down before timeoutMs", async () => {
    const hangingWorker = mock<BaseWorker>();
    hangingWorker.run.mockReturnValue(new Promise(() => {})); // Never resolves
    hangingWorker.dispose.mockImplementation(() => {});

    const registry = new WorkerRegistry(logger, 2000);
    registry.register(hangingWorker);

    const runPromise = registry.run();

    registry.dispose();

    const expectation = expect(runPromise).rejects.toThrow(
      "Worker failed to shut down within allotted timeout",
    );

    // Fast-forward past timeoutMs (2000ms)
    await vi.advanceTimersByTimeAsync(2500);

    await expectation;
  });
});
