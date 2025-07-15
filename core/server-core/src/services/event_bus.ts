import type { ServiceCradle } from "../index.ts";
import type { ConsumerConfig, JsMsg, StreamConfig } from "nats";
import {
  AckPolicy,
  DeliverPolicy,
  NatsError,
  RetentionPolicy,
  StorageType,
} from "nats";
import type { NATSClientFactory } from "../clients/nats.ts";
import type { Metric } from "../clients/metrics.ts";
import { SimpleMutex } from "nats/lib/nats-base-client/util.js";
import { decode, encode } from "cbor-x";
import { Compress, Decompress } from "../util/message_compression.ts";
import { Static, TSchema } from "@sinclair/typebox";

type Props = Pick<
  ServiceCradle,
  "natsClientFactory" | "logger" | "metricsClient"
>;

export type EventItem<T> = {
  id: number;
  subject: string;
  timestamp: Date;
  attempt: number;
  data: T;
};

export type EventSubscribeOptions<T> = {
  handler: EventHandlerFn<T>;
  backoff?: (attempts: number) => number;
  concurrency?: number;
};

export type EventSubscriberHandle<T> = {
  _type: string;
  _data: string | EventHandlerFn<T>;
};

export class EventBusNonRetryableError extends Error {}

type EventHandlerFn<T> = (e: EventItem<T>) => Promise<void> | void;

enum StreamType {
  Events = "events",
  Queue = "queue",
}

const STREAMS: Record<
  StreamType,
  Pick<StreamConfig, "name" | "retention" | "storage">
> = {
  [StreamType.Events]: {
    name: "noctf_events",
    retention: RetentionPolicy.Interest,
    storage: StorageType.Memory,
  },
  [StreamType.Queue]: {
    name: "noctf_queue",
    retention: RetentionPolicy.Workqueue,
    storage: StorageType.Memory,
  },
};

const DELIVER_POLICIES: Record<StreamType, DeliverPolicy> = {
  [StreamType.Events]: DeliverPolicy.New,
  [StreamType.Queue]: DeliverPolicy.All,
};

const DEFAULT_BACKOFF_STRATEGY = () => 10000 + Math.floor(Math.random() * 1000);

export class EventBusService {
  private readonly logger;
  private readonly metricsClient;
  private readonly natsClientFactory;
  private natsClient: Awaited<ReturnType<NATSClientFactory["getClient"]>>;

  constructor({ natsClientFactory, logger, metricsClient }: Props) {
    this.logger = logger;
    this.metricsClient = metricsClient;
    this.natsClientFactory = natsClientFactory;
    this.logger.info("Starting event bus");
  }

  /**
   * Subscribe to a queue
   * @param consumer name of queue, must be unique
   * @param subjects name of the nats subject to subscribe to
   * @param handler job processing handler
   * @param type message type to receive
   * published to a remote queue. this is more reliable, since jobs can be retried by bullmq.
   */
  async subscribe<T>(
    signal: AbortSignal,
    consumer: string | undefined,
    subjects: string[],
    options: EventSubscribeOptions<T>,
  ) {
    if (!this.natsClient) {
      await this.init();
    }
    const types = new Set(subjects.map((x) => x.split(".")[0]));
    if (
      types.size > 1 ||
      (!types.has(StreamType.Events) && !types.has(StreamType.Queue))
    ) {
      throw new Error("cannot listen on both queue and events, or none");
    }
    if (types.has(StreamType.Queue) && !consumer) {
      throw new Error("Cannot listen to queue using an unnamed consumer");
    }
    const type: StreamType = Array.from(
      types.values(),
    )[0] as unknown as StreamType;

    const js = await this.natsClient.jetstream();
    const manager = await js.jetstreamManager();
    const stream = STREAMS[type];
    const updateable: Partial<ConsumerConfig> = {
      filter_subjects: subjects,
      ack_wait: 60 * 10 ** 9,
      inactive_threshold: 30 * 60 * 10 ** 9,
    };

    this.logger.info(
      { consumer, stream: stream.name },
      "Upserting eventbus consumer",
    );
    let name: string;
    try {
      const cons = await manager.consumers.add(stream.name, {
        durable_name: consumer,
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DELIVER_POLICIES[type],
        max_deliver: 5,
        ...updateable,
      });
      name = cons.name;
    } catch (e) {
      if (!consumer) throw e;
      name = consumer;
      if (e instanceof NatsError) {
        const c = await manager.consumers.info(stream.name, consumer);
        const config = { ...c.config, ...updateable };
        await manager.consumers.update(stream.name, consumer, config);
      }
    }

    await this.listen(signal, type, name, { ...options, ephemeral: !consumer });
  }

  async publish<T extends TSchema | string>(
    subject: T,
    data: T extends TSchema ? Static<T> : unknown,
  ) {
    if (!this.natsClient) {
      await this.init();
    }
    await this.natsClient.publish(
      typeof subject === "string" ? subject : subject.$id!,
      await Compress(encode(data)),
    );
  }

  private async listen<T>(
    signal: AbortSignal,
    streamType: StreamType,
    name: string,
    options: EventSubscribeOptions<T> & { ephemeral: boolean },
  ) {
    const rl = new SimpleMutex(options.concurrency || 1);
    const jetstream = this.natsClient.jetstream();
    const stream = STREAMS[streamType];
    const q = await jetstream.consumers.get(stream.name, name);
    const logName = options.ephemeral ? `ephemeral-${name}` : name;
    while (!signal.aborted) {
      this.logger.info(
        { consumer: logName, stream: stream.name },
        "Waiting for messages",
      );
      const messages = await q.consume({
        max_messages: options.concurrency || 1,
      });
      for await (const m of messages) {
        await rl.lock();
        void this.consume(m, options)
          .catch((err) =>
            this.logger.error(
              { consumer: logName, stack: err.stack },
              "Failed to consume",
            ),
          )
          .finally(() => rl.unlock());
      }
    }
  }

  private async consume<T>(message: JsMsg, options: EventSubscribeOptions<T>) {
    const consumer = message.info.consumer;
    const labels: Record<string, string> = {
      worker_type: "eventbus_nats",
      consumer,
    };
    const metrics: Metric[] = [];
    const interval = setInterval(async () => {
      try {
        await message.working();
      } catch (err) {
        this.logger.warn(err, "Failed to heartbeat message");
      }
    }, 30 * 1000);
    const start = performance.now();
    const timestamp = Math.floor(message.info.timestampNanos / 1000000);
    try {
      this.logger.info(
        { consumer, subject: message.subject, id: message.seq },
        "Processing message",
      );
      await options.handler({
        id: message.seq,
        subject: message.subject,
        timestamp: new Date(timestamp),
        attempt: message.info.redeliveryCount,
        data: decode(await Decompress(message.data)),
      });
      await message.ack();
      const elapsed = performance.now() - start;
      this.logger.info(
        { consumer, subject: message.subject, id: message.seq, elapsed },
        "Processed message",
      );
      metrics.push(
        ["QueueToFinishTime", Date.now() - timestamp],
        ["Success", 1],
        ["ProcessTime", elapsed],
      );
    } catch (err) {
      const elapsed = performance.now() - start;
      if (err instanceof EventBusNonRetryableError) {
        this.logger.error(
          {
            consumer,
            subject: message.subject,
            id: message.seq,
            err,
            elapsed,
          },
          "Failed to process message and a non-retryable error was thrown",
        );
        await message.term(err.message);
        metrics.push(
          ["QueueToFinishTime", Date.now() - timestamp],
          ["NonRetryableError", 1],
        );
      } else {
        this.logger.error(
          {
            consumer,
            subject: message.subject,
            id: message.seq,
            err,
            elapsed,
          },
          "Failed to process message, requeueing",
        );
        await message.nak(
          Math.floor(
            (options.backoff ? options.backoff : DEFAULT_BACKOFF_STRATEGY)(
              message.info.redeliveryCount,
            ),
          ),
        );
      }
      metrics.push(["Success", 0], ["ProcessTime", elapsed]);
    } finally {
      clearInterval(interval);
      this.metricsClient.recordAggregate(metrics, labels);
    }
  }

  private async init() {
    this.natsClient = await this.natsClientFactory.getClient();
    const manager = await this.natsClient.jetstream().jetstreamManager();
    for (const type of Object.keys(STREAMS)) {
      const stream = STREAMS[type as unknown as StreamType];
      this.logger.info("Upserting stream %s", stream.name);
      try {
        await manager.streams.add({
          ...stream,
          subjects: [`${type}.>`],
        });
      } catch (e) {
        if (e instanceof NatsError) {
          this.logger.warn(
            {
              stack: e.stack,
              name: stream.name,
            },
            "Error creating nats stream",
          );
          await manager.streams.update(stream.name, {
            ...stream,
            subjects: [`${type}.>`],
          });
        }
      }
    }
  }
}
