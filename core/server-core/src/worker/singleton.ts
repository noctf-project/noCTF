import { LockService, LockServiceError } from "../services/lock.ts";
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
};

const MIN_DELAY = 100;
const KEY_PREFIX = "worker:singleton";

export class SingletonWorker implements BaseWorker {
  private readonly lockService;
  private readonly logger;
  private readonly lockTimeoutSeconds;
  private readonly intervalSeconds;
  private readonly name;
  private readonly triggerHook;
  private readonly handler;

  private abort: AbortController;

  constructor({
    lockService,
    logger,
    lockTimeoutSeconds,
    intervalSeconds,
    name,
    triggerHook,
    handler,
  }: Props) {
    this.lockService = lockService;
    this.logger = logger;
    this.lockTimeoutSeconds = lockTimeoutSeconds || 30;
    this.intervalSeconds = intervalSeconds;
    this.name = name;
    this.triggerHook = triggerHook;
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
          async () => {
            await this.handler(this.abort.signal);
            await Delay(
              Math.max(
                MIN_DELAY,
                this.intervalSeconds * 1000 - stopwatch.elapsed(),
              ),
            );
          },
          this.lockTimeoutSeconds,
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
        );
      }
    }
  }

  dispose(): void {
    this.abort.abort();
  }
}
