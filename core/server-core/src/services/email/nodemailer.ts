import { createTransport, Transporter } from "nodemailer";
import { ServiceCradle } from "../../index.ts";
import { EmailPayload, EmailProvider } from "./types.ts";
import { EmailConfig } from "@noctf/api/config";

type Props = Pick<ServiceCradle, "configService">;

export class NodeMailerProvider implements EmailProvider {
  public readonly name = "nodemailer";
  public readonly queued = true;

  private readonly configService;

  private configVersion: number;
  private transport: Transporter;

  constructor({ configService }: Props) {
    this.configService = configService;
  }

  async send(payload: EmailPayload): Promise<void> {
    const transport = await this.getTransport();
    await transport.sendMail({
      from: payload.from,
      to: payload.to,
      replyTo: payload.replyTo,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      text: payload.text,
    });
  }

  async validate(config: Parameters<typeof createTransport>[0]): Promise<void> {
    const transport = createTransport(config);
    await transport.verify();
  }

  private async getTransport() {
    const data = (await this.configService.get(EmailConfig)) || ({} as any);
    if (!this.transport || this.configVersion !== data.version) {
      if (this.transport) this.transport.close();
      this.transport = createTransport(data.value.config);
      this.configVersion = data.version;
    }
    return this.transport;
  }
}
