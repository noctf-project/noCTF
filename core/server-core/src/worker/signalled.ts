import { Logger } from "../types/primitives.ts";
import { Delay } from "../util/time.ts";
import { BaseWorker } from "./types.ts";

export class SignalledWorker implements BaseWorker {
  private controller: AbortController;

  private readonly name;
  private readonly handler;
  private readonly logger;

  constructor({
    name,
    handler,
    logger,
  }: {
    name: string;
    handler: (s: AbortSignal) => Promise<void>;
    logger: Logger;
  }) {
    this.name = name;
    this.handler = handler;
    this.logger = logger;
  }
  dispose(): void {
    this.controller.abort("Disposed");
  }

  async run() {
    if (this.controller) throw new Error("Worker is already running");
    this.controller = new AbortController();
    while (!this.controller.signal.aborted) {
      try {
        await this.handler(this.controller.signal);
      } catch (error) {
        this.logger.error(
          { name: this.name, error },
          "Worker threw error, restarting",
        );
      } finally {
        // so it doesn't infinite loop
        await Delay(100);
      }
    }
  }
}
