import {
  LockService,
  LockServiceError,
  WithLeaseOptions,
} from "../services/lock.ts";
import { Logger } from "../types/primitives.ts";
import { Stopwatch } from "../util/stopwatch.ts";
import { Delay } from "../util/time.ts";
import { BaseWorker } from "./types.ts";

type Props<T = unknown> = {
  name: string;
  logger: Logger;
  lockService: LockService;
  handler: (signal: AbortSignal, trigger?: T) => Promise<void>;
  triggerHook?: (
    signal: AbortSignal,
    onTrigger: (trigger: T) => void,
  ) => Promise<void>;
  intervalSeconds: number;
  lockTimeoutSeconds?: number;
  lockOptions?: WithLeaseOptions;
};

const MIN_DELAY = 100;
const KEY_PREFIX = "worker:singleton";

export class SingletonWorker implements BaseWorker {
  private readonly lockService;
  private readonly logger;
  private readonly lockOptions: WithLeaseOptions;
  private readonly intervalSeconds;
  readonly name: string;
  private readonly handler;

  private abort: AbortController;

  constructor({
    lockService,
    logger,
    lockTimeoutSeconds,
    lockOptions,
    intervalSeconds,
    name,
    handler,
  }: Props) {
    this.lockService = lockService;
    this.logger = logger;
    this.lockOptions = {
      leaseDurationSeconds:
        lockOptions?.leaseDurationSeconds ?? lockTimeoutSeconds ?? 30,
      ...lockOptions,
    };
    this.intervalSeconds = intervalSeconds;
    this.name = name;
    this.handler = handler;
  }

  async run(): Promise<void> {
    this.abort = new AbortController();

    const stopwatch = new Stopwatch();
    while (!this.abort.signal.aborted) {
      stopwatch.clear();
      try {
        await this.lockService.withLease(
          `${KEY_PREFIX}:${this.name}`,
          async (leaseSignal) => {
            const signal = AbortSignal.any([this.abort.signal, leaseSignal]);
            await this.handler(signal);
            await Delay(
              Math.max(
                MIN_DELAY,
                this.intervalSeconds * 1000 - stopwatch.elapsed(),
              ),
              signal,
            );
          },
          this.lockOptions,
        );
      } catch (e) {
        if (!(e instanceof LockServiceError)) {
          this.logger.error(e, "Error encountered while processing handler");
        }
        await Delay(
          Math.max(
            MIN_DELAY,
            this.intervalSeconds * 1000 - stopwatch.elapsed(),
          ),
          this.abort.signal,
        );
      }
    }
  }

  dispose(): void {
    this.abort.abort();
  }
}
