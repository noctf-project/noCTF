import { EmailConfig, SetupConfig } from "@noctf/api/config";
import { ServiceCradle } from "../../index.ts";
import { EmailProvider } from "./types.ts";
import { DummyEmailProvider } from "./dummy.ts";
import { EmailAddress, EmailAddressOrUserId } from "@noctf/api/datatypes";
import { UserDAO } from "../../dao/user.ts";
import { EmailQueueEvent } from "@noctf/api/events";

type Props = Pick<
  ServiceCradle,
  "logger" | "configService" | "databaseClient" | "eventBusService"
>;

export class EmailService {
  private readonly configService;
  private readonly eventBusService;
  private readonly logger;
  private readonly userDAO;

  private readonly providers = new Map<string, EmailProvider>();

  constructor({
    configService,
    logger,
    eventBusService,
    databaseClient,
  }: Props) {
    this.configService = configService;
    this.eventBusService = eventBusService;
    this.userDAO = new UserDAO(databaseClient.get());
    this.logger = logger;
    void this.init();
    this.register(new DummyEmailProvider({ logger: this.logger }));
  }

  async init() {
    await this.configService.register(
      EmailConfig,
      {
        provider: "dummy",
        from: {
          name: "noCTF Administrator",
          address: "noreply@example.com",
        },
      },
      async (v) => {
        const provider = this.providers.get(v.provider);
        if (!provider) throw new Error(`Provider ${v.provider} does not exist`);
        await provider.validate(v.config);
      },
    );
  }

  register(provider: EmailProvider) {
    if (this.providers.has(provider.name)) {
      throw new Error(`Email provider of type ${provider.name} already exists`);
    }
    this.providers.set(provider.name, provider);
  }

  async sendEmail(data: EmailQueueEvent) {
    const config = (await this.configService.get(EmailConfig))?.value;

    const provider = this.providers.get(config.provider);
    if (!provider || !provider.queued) {
      await this.doSend(config, data);
      return;
    }
    await this.eventBusService.publish(EmailQueueEvent, data);
  }

  private async doSend(config: EmailConfig, data: EmailQueueEvent) {
    const { name: siteName } = (await this.configService.get(SetupConfig))
      .value;
    const provider = this.providers.get(config.provider);
    if (!provider)
      throw new Error(
        `Cannot send email: Configured provider ${provider} does not exist`,
      );

    await provider.send({
      from: config.from,
      to: await this.lookupAddresses(data.to),
      cc: await this.lookupAddresses(data.cc),
      bcc: await this.lookupAddresses(data.bcc),
      subject: `[${siteName}] ${data.subject}`,
      text: data.text,
    });
  }

  /**
   * Lookup addresses for user id. This can be single threaded
   * as we don't want to overwhelm our DB.
   * @param addresses list of addresses or user ids
   */
  private async lookupAddresses(addresses?: EmailAddressOrUserId[]) {
    if (!addresses) return;
    const out: EmailAddress[] = [];
    for (const idOrEmail of addresses) {
      if (typeof idOrEmail === "object") {
        out.push(idOrEmail);
        continue;
      }
      const data = await this.userDAO.getNameAndProviderId(idOrEmail, "email");
      if (!data) {
        this.logger.debug(
          { user_id: idOrEmail },
          "User does not have an email address",
        );
        continue;
      }
      out.push({ address: data.provider_id, name: data.name });
    }
    return out;
  }

  async worker(signal: AbortSignal) {
    await this.eventBusService.subscribe<EmailQueueEvent>(
      signal,
      "EmailWorker",
      [EmailQueueEvent.$id!],
      {
        concurrency: 3,
        handler: async (data) => {
          const config = (await this.configService.get(EmailConfig))?.value;
          if (!config) {
            this.logger.error("Email config does not exist");
            return;
          }
          await this.doSend(config, data.data);
        },
      },
    );
  }
}
