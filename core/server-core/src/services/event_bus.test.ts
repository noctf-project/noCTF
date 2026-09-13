import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockDeep, DeepMockProxy } from "vitest-mock-extended";
import { EventBusService } from "./event_bus.ts";
import { NATSClientFactory } from "../clients/nats.ts";
import { MetricsClient } from "../clients/metrics.ts";
import { Logger } from "../types/primitives.ts";
import type { NatsConnection, JetStreamClient, JetStreamManager } from "nats";
import { Type } from "@sinclair/typebox";

describe(EventBusService, () => {
  let natsClientFactory: DeepMockProxy<NATSClientFactory>;
  let logger: DeepMockProxy<Logger>;
  let metricsClient: DeepMockProxy<MetricsClient>;
  let natsClient: DeepMockProxy<NatsConnection>;
  let jetstream: DeepMockProxy<JetStreamClient>;
  let jsm: DeepMockProxy<JetStreamManager>;
  let service: EventBusService;

  beforeEach(() => {
    natsClientFactory = mockDeep<NATSClientFactory>();
    logger = mockDeep<Logger>();
    metricsClient = mockDeep<MetricsClient>();
    natsClient = mockDeep<NatsConnection>();
    jetstream = mockDeep<JetStreamClient>();
    jsm = mockDeep<JetStreamManager>();

    natsClientFactory.getClient.mockResolvedValue(natsClient);
    natsClient.jetstream.mockReturnValue(jetstream);
    jetstream.jetstreamManager.mockResolvedValue(jsm);

    service = new EventBusService({
      natsClientFactory,
      logger,
      metricsClient,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("publish", () => {
    it("publishes message to subject string", async () => {
      await service.publish("events.user.created", { user_id: 1 });

      expect(natsClient.publish).toHaveBeenCalledWith(
        "events.user.created",
        expect.any(Uint8Array),
      );
    });

    it("publishes message using TypeBox schema $id", async () => {
      const Schema = Type.Object(
        { user_id: Type.Number() },
        { $id: "events.user.updated" },
      );

      await service.publish(Schema, { user_id: 2 });

      expect(natsClient.publish).toHaveBeenCalledWith(
        "events.user.updated",
        expect.any(Uint8Array),
      );
    });
  });

  describe("publishBatch", () => {
    it("publishes multiple messages in batch", async () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      await service.publishBatch("events.items.batch", items);

      expect(natsClient.publish).toHaveBeenCalledTimes(3);
    });
  });

  describe("subscribe validation", () => {
    it("rejects listening on mixed streams or invalid stream prefixes", async () => {
      const controller = new AbortController();

      await expect(
        service.subscribe(controller.signal, "cons", ["events.a", "queue.b"], {
          handler: vi.fn(),
        }),
      ).rejects.toThrow("cannot listen on both queue and events, or none");

      await expect(
        service.subscribe(controller.signal, "cons", ["unknown.subject"], {
          handler: vi.fn(),
        }),
      ).rejects.toThrow("cannot listen on both queue and events, or none");
    });

    it("rejects queue subscription with unnamed consumer", async () => {
      const controller = new AbortController();

      await expect(
        service.subscribe(controller.signal, undefined, ["queue.test"], {
          handler: vi.fn(),
        }),
      ).rejects.toThrow("Cannot listen to queue using an unnamed consumer");
    });
  });
});
