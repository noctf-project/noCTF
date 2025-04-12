import { ServiceCradle } from "../../index.ts";
import { EmailPayload, EmailProvider } from "./types.ts";

type Props = Pick<ServiceCradle, "logger" | "configService">;
export class SMTPEmailProvider implements EmailProvider {
  public readonly name = "smtp";
  public readonly queued = true;

  constructor({}) {}

  async send(payload: EmailPayload): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
