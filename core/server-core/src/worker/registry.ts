import { Logger } from "../types/primitives.ts";
import { BaseWorker } from "./types.ts";

export class WorkerRegistry implements BaseWorker {
  private workers: BaseWorker[] = [];

  private timeout: PromiseWithResolvers<void> | null;
  private cancellation: ReturnType<typeof setTimeout> | null;

  constructor(
    private readonly logger: Logger,
    private readonly timeoutMs = 60000,
  ) {}

  register(w: BaseWorker) {
    this.workers.push(w);
  }

  async run() {
    this.timeout = Promise.withResolvers();
    const jobs = Promise.all(this.workers.map((w) => w.run()));
    await Promise.race([jobs, this.timeout.promise]);
    if (this.cancellation) clearTimeout(this.cancellation);
    this.cancellation = null;
    this.timeout = null;
  }

  dispose() {
    this.logger.info("Gracefully shutting down workers");
    this.workers.forEach((w) => w.dispose());
    this.cancellation = setTimeout(() => {
      this.timeout?.reject(
        new Error("Worker failed to shut down within allotted timeout"),
      );
      this.timeout = null;
      this.cancellation = null;
    }, this.timeoutMs);
  }
}
