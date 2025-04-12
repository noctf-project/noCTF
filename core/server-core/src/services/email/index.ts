import { EmailConfig } from "@noctf/api/config";
import { ServiceCradle } from "../../index.ts";
import { EmailPayload, EmailProvider } from "./types.ts";
import { DummyEmailProvider } from "./dummy.ts";
import { NodeMailerProvider } from "./nodemailer.ts";

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
    this.register(new NodeMailerProvider({ logger: this.logger, configService }));
  }

  async init() {
    await this.configService.register(EmailConfig, {
      provider: "dummy",
      from: {
        name: "noCTF Administrator",
        address: "noreply@example.com",
      },
    }, async (v) => {
      const provider = this.providers.get(v.provider);
      if (!provider) return `Provider ${v.provider} does not exist`;
      try {
        await provider.validate(v.config);
      } catch (e) {
        return e.message;
      }
      return null;
    });
  }

  register(provider: EmailProvider) {
    if (this.providers.has(provider.name)) {
      throw new Error(`Email provider of type ${provider.name} already exists`);
    }
    this.providers.set(provider.name, provider);
  }

  async sendEmail(payload: Omit<EmailPayload, "from">) {
    const { provider: name, from } = (
      await this.configService.get<EmailConfig>(EmailConfig.$id!)
    )?.value;
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Provider ${name} does not exist`);
    if (!provider.queued)
      await provider.send({ ...payload, from });
  }
}
