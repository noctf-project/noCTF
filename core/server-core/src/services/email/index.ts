import { EmailConfig } from "@noctf/api/config";
import { ServiceCradle } from "../../index.ts";
import { EmailProvider } from "./types.ts";
import { EmailAddress } from "@noctf/api/datatypes";
import { DummyEmailProvider } from "./dummy.ts";
import { SMTPEmailProvider } from "./smtp.ts";

type Props = Pick<ServiceCradle, "logger" | "configService">;

export class EmailService {
  private readonly configService;
  private readonly logger;

  private readonly providers = new Map<string, EmailProvider>();

  constructor({ configService, logger }: Props) {
    this.configService = configService;
    this.logger = logger;
    void this.init();
    this.register(new DummyEmailProvider({ logger: this.logger }));
    this.register(new SMTPEmailProvider({ logger: this.logger }));
  }

  async init() {
    await this.configService.register(EmailConfig, {
      provider: "dummy",
      from: {
        name: "noCTF Administrator",
        email: "noreply@example.com",
      },
    });
  }

  register(provider: EmailProvider) {
    if (this.providers.has(provider.name)) {
      throw new Error(`Email provider of type ${provider.name} already exists`);
    }
    this.providers.set(provider.name, provider);
  }

  async sendToEmail(
    recipients: {
      to?: EmailAddress[];
      cc?: EmailAddress[];
      bcc?: EmailAddress[];
    },
    subject: string,
    body: string,
  ) {
    const { provider: name, from } = (
      await this.configService.get<EmailConfig>(EmailConfig.$id!)
    )?.value;
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Provider ${name} does not exist`);
    if (!provider.queued)
      await provider.send({
        ...recipients,
        from,
        subject,
        body,
      });
  }
}
