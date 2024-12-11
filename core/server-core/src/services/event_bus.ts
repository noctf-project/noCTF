import { Queue, Worker } from "bullmq";
import { ServiceCradle } from "../index.ts";
import { RedisUrlType as RedisUrlType } from "../clients/redis_factory.ts";

type Props = Pick<ServiceCradle, "redisClientFactory" | "logger">;

export type EventItem<T> = {
  id: string;
  type: string;
  attempt: number;
  data: T;
};
export type EventPublishOptions = {
  delay?: number;
};
export type EventSubscriberHandle<T> = {
  _type: string;
  _data: string | EventHandlerFn<T>;
};
type EventHandlerFn<T> = (e: EventItem<T>) => Promise<void>;

const ACTIVE_REMOTE_QUEUES_KEY = "core:eventbus:activequeues";
const ACTIVE_QUEUE_HEARTBEAT_EXPIRE = 30;

export class EventBusService {
  private readonly logger;
  private readonly queueClient;
  private readonly pubSubClient;

  // These values do leak but the number of queues is not expected to grow over time.
  // Will implement GC at later
  private readonly bullWorkers: Map<string, Worker> = new Map();
  private readonly bullQueues: Map<string, Queue> = new Map();

  private remoteInterval?: NodeJS.Timeout;
  private localQueues: {
    [key: string]: { id: number; fn: Set<EventHandlerFn<unknown>> };
  } = {};
  private remoteQueues: { [key: string]: Set<string> } = {};

  constructor({ redisClientFactory, logger }: Props) {
    this.logger = logger;
    this.queueClient = redisClientFactory.createClient(RedisUrlType.Event, {
      maxRetriesPerRequest: 0,
    });
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
    type: string,
    name?: string,
  ): EventSubscriberHandle<T> {
    if (name.includes("|")) {
      throw new Error("message type cannot contain a pipe character");
    }
    if (name) {
      const qualifier = `${type}|${name}`;
      if (this.bullWorkers.has(qualifier)) {
        throw new Error(
          `remote worker with name ${name} and type ${type} is already registered in this process`,
        );
      }
      const worker = new Worker(
        qualifier,
        async (job) => {
          handler({
            id: job.id,
            type,
            attempt: job.attemptsMade,
            data: job.data,
          });
        },
        {
          connection: this.queueClient,
        },
      );
      this.bullWorkers.set(qualifier, worker);
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
    { delay }: EventPublishOptions = {},
  ) {
    if (this.localQueues[type]) {
      const id = (++this.localQueues[type].id).toString();
      for (const fn of this.localQueues[type].fn) {
        this.logger.debug({ type }, "publishing message to local queue");
        const closure = async () => {
          try {
            fn({
              id,
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
      for (const qualifier of this.remoteQueues[type]) {
        this.logger.debug({ qualifier }, "publishing message to remote queue");
        await this.bullQueues.get(qualifier).add("", data);
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
      args.push(i);
    }
    if (args.length) {
      await this.queueClient.zadd(ACTIVE_REMOTE_QUEUES_KEY, ...args);
    }
    const remotes = await this.queueClient.zrangebyscore(
      ACTIVE_REMOTE_QUEUES_KEY,
      now,
      Number.MAX_SAFE_INTEGER,
    );
    const workers: EventBusService["remoteQueues"] = {};
    for (let i = 0; i < remotes.length; i++) {
      const qualifier = remotes[i];
      const sp = qualifier.indexOf("|");
      if (sp === -1) {
        throw new Error("invalid queue name spec on remote");
      }
      const type = qualifier.substring(0, sp);
      if (!workers[type]) {
        workers[type] = new Set();
      }
      workers[type].add(qualifier);
      if (!this.bullQueues.has(qualifier)) {
        this.bullQueues.set(
          qualifier,
          new Queue(qualifier, { connection: this.queueClient }),
        );
      }
    }
    this.remoteQueues = workers;
    this.logger.debug({ queues: workers }, "Syncing remote workers");
    void this.queueClient.zremrangebyscore(ACTIVE_REMOTE_QUEUES_KEY, 0, now);
  }
}
