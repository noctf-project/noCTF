import { Queue, Worker } from "bullmq";
import { ServiceCradle } from "../index.ts";

type Props = Pick<ServiceCradle, "redisClientFactory" | "logger">;

export type EventItem<T> = {
  id: string
  attempt: number
  data: T
};

const ACTIVE_REMOTE_QUEUES_KEY = "core:eventbus:activequeues";
const ACTIVE_QUEUE_HEARTBEAT_EXPIRE = 60;

export class EventBusService {
  private readonly logger;
  private readonly queuerClient;
  private readonly workerClient;

  // These values do leak but the number of queues is not expected to grow over time.
  // Will implement GC at later
  private readonly bullWorkers: Map<string, Worker> = new Map();
  private readonly bullQueues: Map<string, Queue> = new Map(); 

  private remoteWorkers: {[key: string]: Set<string>} = {};

  constructor({ redisClientFactory, logger }: Props) {
    this.logger = logger;
    this.queuerClient = redisClientFactory.createClient();
    this.workerClient = redisClientFactory.createClient({ maxRetriesPerRequest: 0 });
  }

  /**
   * Subscribe to a queue
   * @param handler job processing handler
   * @param type message type to receive
   * @param name name of queue, cannot have a pipe charcater. if provided the message will be
   * published to a remote queue. this is more reliable, since jobs can be retried by bullmq.
   */
  subscribe<T>(handler: (e: EventItem<T>) => Promise<void>, type: string, name?: string) {
    if (name.includes('|')) {
      throw new Error('message type cannot contain a pipe character');
    }
    if (name) {
      const qualifier = `${type}|${name}`;
      if (this.bullWorkers.has(qualifier)) {
        throw new Error(
          `remote worker with name ${name} and type ${type} is already registered in this process`
        );
      }
      const worker = new Worker(qualifier, async (job) => {
        handler({
          id: job.id,
          attempt: job.attemptsMade,
          data: job.data
        });
      }, {
        connection: this.workerClient
      });
      this.bullWorkers.set(qualifier, worker);
    }
  }

  async publish(type: string, data: unknown) {
    // TODO: implement local

    if(this.remoteWorkers[type]) {
      for (const qualifier of this.remoteWorkers[type]) {
        this.logger.debug({ qualifier }, "publishing message to remote queue");
        await this.bullQueues.get(qualifier).add("", data);
      }
    }
  }

  /**
   * This function should be run on a setInterval to renew the lease on the workers.
   */
  private async _maintainRemote() {
    const now = Math.floor(Date.now()/1000); // 1 minute lease
    const args: (string | Buffer | number)[] = [];
    for (const i of this.bullWorkers.keys()) {
      args.push(now + ACTIVE_QUEUE_HEARTBEAT_EXPIRE * 2);
      args.push(i);
    }
    await this.queuerClient.zadd(ACTIVE_REMOTE_QUEUES_KEY, ...args);
    const remotes = await this.queuerClient.zrangebyscore(
      ACTIVE_REMOTE_QUEUES_KEY,
      now, Number.MAX_SAFE_INTEGER);
    this.logger.debug({ remotes }, "event bus remotes");
    const workers: EventBusService["remoteWorkers"] = {};
    for (let i = 0; i < remotes.length; i++) {
      const qualifier = remotes[i];
      const sp = qualifier.indexOf('|');
      if (sp === -1) {
        throw new Error("invalid queue name spec on remote");
      }
      const type = qualifier.substring(0, sp);
      if (!workers[type]) {
        workers[type] = new Set();
      }
      workers[type].add(qualifier);
      if (!this.bullQueues.has(qualifier)) {
        this.bullQueues.set(qualifier, new Queue(qualifier, { connection: this.queuerClient }));
      }
    }
    this.remoteWorkers = workers;
    void this.queuerClient.zremrangebyscore(ACTIVE_REMOTE_QUEUES_KEY, 0, now);
  }
}