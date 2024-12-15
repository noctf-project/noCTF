import { DefaultJobOptions, Queue, Worker } from "bullmq";
import { ServiceCradle } from "../index.ts";
import { RedisUrlType as RedisUrlType } from "../clients/redis_factory.ts";
import { decode, encode } from "cbor2";
import { EvaluateFilter, EventFilter } from "../util/filter.ts";
import { TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export { UnrecoverableError } from "bullmq";

type Props = Pick<ServiceCradle, "redisClientFactory" | "logger" | "metricsClient">;

export type EventItem<T> = {
  id: string;
  type: string;
  timestamp: number;
  attempt: number;
  data: T;
};
export type EventSubscribeOptions = {
  name?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter?: any;
  backoffStrategy?: (attempts: number) => number;
  concurrency?: number;
};
export type EventPublishOptions = {
  delay?: number;
  attempts?: number;
};
export type EventSubscriberHandle<T> = {
  _type: string;
  _data: string | EventHandlerFn<T>;
};

type RemoteSpec = [string, EventFilter];
type SerializedSpec = Buffer;

type EventHandlerFn<T> = (e: EventItem<T>) => Promise<void> | void;

const ACTIVE_REMOTE_QUEUES_KEY = "core:eventbus:activequeues";
const ACTIVE_QUEUE_HEARTBEAT_EXPIRE = 30;
const DEFAULT_BACKOFF_STRATEGY = (attempts: number) => {
  const base = Math.min(2 ** (attempts - 1) * 1000, 30000);
  const jitter = Math.floor(Math.random() * 1000);
  return base + jitter;
};

export class EventBusService {
  private readonly logger;
  private readonly metricsClient;
  private readonly queueClient;
  private readonly pubSubClient;

  // These values do leak but the number of queues is not expected to grow over time.
  // Will implement GC at later
  private readonly bullWorkers: Map<string, [SerializedSpec, Worker]> =
    new Map();
  private readonly bullQueues: Map<string, Queue> = new Map();

  private remoteInterval?: NodeJS.Timeout;
  private localQueues: {
    [key: string]: { id: number; fn: Set<EventHandlerFn<unknown>> };
  } = {};
  private remoteQueues: { [key: string]: Map<string, EventFilter> } = {};

  constructor({ redisClientFactory, logger, metricsClient }: Props) {
    this.logger = logger;
    this.metricsClient = metricsClient;
    this.queueClient = redisClientFactory.getSharedClient(RedisUrlType.Event);
    this.pubSubClient = redisClientFactory.createClient(RedisUrlType.Event);
  }

  start() {
    if (this.remoteInterval) {
      throw new Error("Event bus already started");
    }
    this.logger.info("Starting EventBusService");
    this.remoteInterval = setInterval(
      this._maintainRemote.bind(this),
      ACTIVE_QUEUE_HEARTBEAT_EXPIRE * 1000,
    );
    setTimeout(() => void this._maintainRemote(), 2000);
  }

  stop() {
    clearInterval(this.remoteInterval);
    this.remoteInterval = null;
  }

  /**
   * Subscribe to a queue
   * @param handler job processing handler
   * @param type message type to receive
   * @param name name of queue, cannot have a pipe charcater. if provided the message will be
   * published to a remote queue. this is more reliable, since jobs can be retried by bullmq.
   */
  subscribe<T>(
    handler: EventHandlerFn<T>,
    schema: TSchema,
    type: string,
    { name, filter, backoffStrategy, concurrency }: EventSubscribeOptions = {},
  ): EventSubscriberHandle<T> {
    if (name) {
      if (name.includes("|")) {
        throw new Error("message type cannot contain a pipe character");
      }
      const qualifier = `${type}|${name}`;
      if (this.bullWorkers.has(qualifier)) {
        throw new Error(
          `remote worker with name ${name} and type ${type} is already registered in this process`,
        );
      }
      const labels: Record<string, string> = {
        worker_type: 'eventbus_bullmq',
        qualifier: qualifier
      };
      const worker = new Worker(
        qualifier,
        async (job) => {
          const start = performance.now();

          try {
            await handler({
              id: job.id,
              timestamp: job.timestamp,
              type,
              attempt: job.attemptsMade,
              data: Value.Convert(schema, job.data) as T,
            });
            this.metricsClient.record("Success", labels, 1);
            this.logger.info(
              {
                name: qualifier,
                attempt: job.attemptsMade,
                id: job.id,
                elapsed: Math.round(performance.now() - start)
              },
              "Processed remote message",
            );
          } catch (e) {
            this.logger.error(
              {
                stack: e.stack,
                name: qualifier,
                attempt: job.attemptsMade,
                id: job.id,
              },
              "Unepected error processing message",
            );
            this.metricsClient.record("Success", labels, 0);
            if (job.attemptsMade >= job.opts.attempts) {
              this.metricsClient.record("ExhaustedRetries", labels, 1);
            }
            throw e;
          } finally {
            this.metricsClient.record("Time", labels, Math.round(performance.now() - start));
          }
        },
        {
          connection: this.queueClient,
          settings: {
            backoffStrategy: backoffStrategy || DEFAULT_BACKOFF_STRATEGY,
          },
          concurrency: concurrency || 1
        },
      );
      const spec = encode([qualifier, filter || null]);
      this.bullWorkers.set(qualifier, [Buffer.from(spec), worker]);
      return {
        _type: type,
        _data: qualifier,
      };
    }

    if (!this.localQueues[type]) {
      this.localQueues[type] = {
        id: 0,
        fn: new Set(),
      };
    }
    if (this.localQueues[type].fn.has(handler)) {
      throw new Error("handler already registered for this type");
    }
    this.localQueues[type].fn.add(handler);
    return {
      _type: type,
      _data: handler,
    };
  }

  unsubscribe({ _data, _type }: EventSubscriberHandle<unknown>) {
    if (typeof _data === "string") {
      this.bullWorkers.delete(_data);
    } else {
      this.localQueues[_type].fn.delete(_data);
    }
  }

  async publish(
    type: string,
    data: unknown,
    { delay, attempts }: DefaultJobOptions = {},
  ) {
    if (this.localQueues[type]) {
      const id = (++this.localQueues[type].id).toString();
      for (const fn of this.localQueues[type].fn) {
        this.logger.debug({ type }, "publishing message to local queue");
        const closure = async () => {
          try {
            fn({
              id,
              timestamp: Date.now(),
              type,
              attempt: 0,
              data,
            });
          } catch (e) {
            this.logger.error("Error handling event", e);
          }
        };
        if (delay) {
          setTimeout(closure, delay);
          return;
        }
        void closure();
      }
    }

    if (this.remoteQueues[type]) {
      for (const [qualifier, filter] of this.remoteQueues[type]) {
        this.logger.debug({ qualifier }, "publishing message to remote queue");
        if (!EvaluateFilter(filter, data)) continue;
        const queue = this.bullQueues.get(qualifier);
        await queue.add("", data, {
          delay,
          attempts: attempts || 10,
          removeOnFail: true,
          removeOnComplete: true,
          backoff: {
            type: "custom",
          },
        });
        this.metricsClient.record('Published', {
          worker_type: 'eventbus_bullmq',
          qualifier: qualifier
        }, 1);
      }
    }
  }

  /**
   * This function should be run on a setInterval to renew the lease on the workers.
   */
  private async _maintainRemote() {
    const now = Math.floor(Date.now() / 1000); // 1 minute lease
    const args: (string | Buffer | number)[] = [];
    for (const i of this.bullWorkers.keys()) {
      args.push(now + ACTIVE_QUEUE_HEARTBEAT_EXPIRE * 2);
      args.push(this.bullWorkers.get(i)[0]);
    }
    if (args.length) {
      await this.queueClient.zadd(ACTIVE_REMOTE_QUEUES_KEY, ...args);
    }
    const remotes = await this.queueClient.zrangebyscoreBuffer(
      ACTIVE_REMOTE_QUEUES_KEY,
      now,
      Number.MAX_SAFE_INTEGER,
    );
    const workers: EventBusService["remoteQueues"] = {};

    let activeQueues = 0;
    for (let i = 0; i < remotes.length; i++) {
      const spec = decode(
        Buffer.from(remotes[remotes.length - i - 1]),
      ) as RemoteSpec;
      const [qualifier, filter] = spec;

      const sp = qualifier.indexOf("|");
      if (sp === -1) {
        throw new Error("invalid queue name spec on remote");
      }
      const type = qualifier.substring(0, sp);
      if (!workers[type]) {
        workers[type] = new Map();
      }
      if (!workers[type].has(qualifier)) {
        activeQueues += 1;
        workers[type].set(qualifier, filter);
        if (!this.bullQueues.has(qualifier)) {
          this.bullQueues.set(
            qualifier,
            new Queue(qualifier, { connection: this.queueClient }),
          );
        }
        this.metricsClient.record(
          'QueueDepth',
          { worker_type: 'eventbus_bullmq', qualifier },
          (await this.bullQueues.get(qualifier).getJobCounts('active')).active
        );
      }
    }
    this.remoteQueues = workers;
    this.logger.debug({ queues: workers }, "Syncing remote workers");
    this.metricsClient.record('ActiveQueues', {worker_type: 'eventbus_bullmq'}, activeQueues);
    void this.queueClient.zremrangebyscore(ACTIVE_REMOTE_QUEUES_KEY, 0, now);
  }
}
