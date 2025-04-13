import { ServiceCradle } from "../../index.ts";
import { EmailPayload, EmailProvider } from "./types.ts";

type Props = Pick<ServiceCradle, "logger">;

export class DummyEmailProvider implements EmailProvider {
  public readonly name = "dummy";
  public readonly queued = false;

  private readonly logger;

  constructor({ logger }: Props) {
    this.logger = logger;
  }

  async send(payload: EmailPayload): Promise<void> {
    this.logger.info(payload, "New Email Message");
  }
}
