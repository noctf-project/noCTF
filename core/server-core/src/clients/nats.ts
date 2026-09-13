import type { NatsConnection } from "@nats-io/transport-node";
import { connect } from "@nats-io/transport-node";
import type { Logger } from "../types/primitives.ts";

export class NATSClientFactory {
  private readonly logger;
  private readonly url;

  private client: NatsConnection;

  constructor(logger: Logger, url: string) {
    this.logger = logger;
    this.url = url;
  }

  async getClient() {
    if (this.client) {
      return this.client;
    }
    const u = new URL(this.url);
    this.logger.info(`Connecting to NATS at ${u.host}:${u.port || 4222}`);
    this.client = await connect({
      servers: this.url,
    });
    return this.client;
  }
}
