import { EmailConfig, SetupConfig } from "@noctf/api/config";
import { ServiceCradle } from "../../index.ts";
import { EmailPayload, EmailProvider } from "./types.ts";
import { DummyEmailProvider } from "./dummy.ts";
import { NodeMailerProvider } from "./nodemailer.ts";
import {
  EmailAddress,
  EmailAddressOrUserId,
  EmailMessage,
} from "@noctf/api/datatypes";
import { UserIdentityDAO } from "../../dao/user_identity.ts";
import { UserDAO } from "../../dao/user.ts";

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
    this.register(
      new NodeMailerProvider({ logger: this.logger, configService }),
    );
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
        if (!provider) return `Provider ${v.provider} does not exist`;
        try {
          await provider.validate(v.config);
        } catch (e) {
          return e.message;
        }
        return null;
      },
    );
  }

  register(provider: EmailProvider) {
    if (this.providers.has(provider.name)) {
      throw new Error(`Email provider of type ${provider.name} already exists`);
    }
    this.providers.set(provider.name, provider);
  }

  async sendEmail(data: EmailMessage) {
    const config = (await this.configService.get<EmailConfig>(EmailConfig.$id!))
      ?.value;

    const provider = this.providers.get(config.provider);
    if (!provider || !provider.queued) {
      await this.doSend(config, data);
      return;
    }
    await this.eventBusService.publish<EmailMessage>("queue.email", data);
  }

  private async doSend(config: EmailConfig, data: EmailMessage) {
    const { name: siteName } = (
      await this.configService.get<SetupConfig>(SetupConfig.$id!)
    )?.value;
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
    await this.eventBusService.subscribe<EmailMessage>(
      signal,
      "EmailWorker",
      ["queue.email"],
      {
        concurrency: 3,
        handler: async (data) => {
          const config = (
            await this.configService.get<EmailConfig>(EmailConfig.$id!)
          )?.value;
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
