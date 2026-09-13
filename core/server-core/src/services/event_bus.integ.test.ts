import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  EventBusNonRetryableError,
  EventBusService,
  EventItem,
} from "./event_bus.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";
import { MetricsClient } from "../clients/metrics.ts";
import type { Logger } from "../types/primitives.ts";
import { Type } from "@sinclair/typebox";

const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  trace: () => {},
  fatal: () => {},
  child: () => noopLogger,
};

describe("EventBusService Integration", () => {
  let clients: TestClients;
  let service: EventBusService;
  const abortControllers: AbortController[] = [];

  beforeAll(() => {
    clients = createTestClients();
    const metricsClient = new MetricsClient(noopLogger, "", "");
    service = new EventBusService({
      natsClientFactory: clients.getNATSFactory(),
      logger: noopLogger,
      metricsClient,
    });
  });

  afterAll(async () => {
    for (const controller of abortControllers) {
      controller.abort();
    }
    await clients.destroy();
  });

  it("publishes and consumes events on ephemeral subscription", async () => {
    const controller = new AbortController();
    abortControllers.push(controller);

    const received: EventItem<{ test_id: string; value: number }>[] = [];
    const donePromise = new Promise<void>((resolve) => {
      void service.subscribe<{ test_id: string; value: number }>(
        controller.signal,
        undefined,
        ["events.test.ephemeral"],
        {
          concurrency: 1,
          handler: (item) => {
            received.push(item);
            resolve();
          },
        },
      );
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    await service.publish("events.test.ephemeral", {
      test_id: "ephemeral-1",
      value: 42,
    });

    await donePromise;

    expect(received).toHaveLength(1);
    expect(received[0].subject).toBe("events.test.ephemeral");
    expect(received[0].data).toEqual({
      test_id: "ephemeral-1",
      value: 42,
    });

    controller.abort();
  });

  it("publishes and consumes workqueue messages with durable consumer", async () => {
    const controller = new AbortController();
    abortControllers.push(controller);

    const consumerName = "integ-queue-worker";
    const subject = "queue.test.tasks";

    const received: EventItem<{ task: string; count: number }>[] = [];
    const expectedCount = 3;

    let resolveAll: () => void;
    const allDonePromise = new Promise<void>((resolve) => {
      resolveAll = resolve;
    });

    void service.subscribe<{ task: string; count: number }>(
      controller.signal,
      consumerName,
      [subject],
      {
        concurrency: 2,
        handler: (item) => {
          received.push(item);
          if (received.length === expectedCount) {
            resolveAll();
          }
        },
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    await service.publishBatch(subject, [
      { task: "task-1", count: 1 },
      { task: "task-2", count: 2 },
      { task: "task-3", count: 3 },
    ]);

    await allDonePromise;

    expect(received).toHaveLength(3);
    const tasks = received.map((x) => x.data.task).sort();
    expect(tasks).toEqual(["task-1", "task-2", "task-3"]);

    controller.abort();
  });

  it("publishes using TypeBox schema with $id", async () => {
    const controller = new AbortController();
    abortControllers.push(controller);

    const Schema = Type.Object(
      { greeting: Type.String() },
      { $id: "events.schema.test" },
    );

    let resolveEvent: (e: EventItem<{ greeting: string }>) => void;
    const eventPromise = new Promise<EventItem<{ greeting: string }>>(
      (resolve) => {
        resolveEvent = resolve;
      },
    );

    void service.subscribe<{ greeting: string }>(
      controller.signal,
      undefined,
      [Schema.$id!],
      {
        handler: (item) => {
          resolveEvent(item);
        },
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    await service.publish(Schema, { greeting: "hello jetstream" });

    const item = await eventPromise;
    expect(item.subject).toBe("events.schema.test");
    expect(item.data).toEqual({ greeting: "hello jetstream" });

    controller.abort();
  });

  it("handles non-retryable error by terminating message", async () => {
    const controller = new AbortController();
    abortControllers.push(controller);

    const subject = "queue.test.term";
    let attempts = 0;

    let resolveDone: () => void;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });

    void service.subscribe<{ fatal: boolean }>(
      controller.signal,
      "integ-queue-fatal-worker",
      [subject],
      {
        max_retries: 3,
        handler: () => {
          attempts++;
          resolveDone();
          throw new EventBusNonRetryableError("fatal test error");
        },
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    await service.publish(subject, { fatal: true });

    await done;
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(attempts).toBe(1);

    controller.abort();
  });
});
