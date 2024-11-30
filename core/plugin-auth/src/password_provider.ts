import { IdentityProvider } from "@noctf/server-core/providers/identity";
import { ConfigService } from "@noctf/server-core/services/config";
import { CONFIG_NAMESPACE } from "./config.ts";
import { AuthMethod } from "@noctf/api/datatypes";
import { IdentityService } from "@noctf/server-core/services/identity";
import { NotFoundError, AuthenticationError } from "@noctf/server-core/errors";
import { AuthRegisterToken } from "@noctf/api/token";
import { FastifyBaseLogger } from "fastify";

type Props = {
  logger: FastifyBaseLogger;
  configService: ConfigService;
  identityService: IdentityService;
};

export class PasswordProvider implements IdentityProvider {
  private logger: FastifyBaseLogger;
  private configService: ConfigService;
  private identityService: IdentityService;

  constructor({ logger, configService, identityService }: Props) {
    this.logger = logger;
    this.configService = configService;
    this.identityService = identityService;

    this.identityService.register(this);
  }

  id(): string {
    return "email";
  }

  async listMethods(): Promise<AuthMethod[]> {
    if ((await this.getConfig()).enablePassword) {
      return [
        {
          provider: "email",
        },
      ];
    }
    return [];
  }

  async authPreCheck(
    email: string,
  ): Promise<string | AuthRegisterToken | null> {
    const { enablePassword, enableRegistrationPassword, validateEmail } =
      await this.getConfig();
    if (!enablePassword) {
      throw new NotFoundError("The requested auth provider cannot be found");
    }
    const identity = await this.identityService.getIdentityForProvider(
      this.id(),
      email,
    );
    if (!identity) {
      if (!enableRegistrationPassword) {
        throw new AuthenticationError(
          "New user registration is currently not available through this provider",
        );
      }
      const subject: AuthRegisterToken = {
        identity: [
          {
            provider: "email",
            provider_id: email,
          },
        ],
      };
      if (validateEmail) {
        // TODO: create a flag with valid_email
        return "Please check your email for a link to create your account";
      }

      return subject;
    }
    if (identity.secret_data) {
      throw new AuthenticationError(
        "Password sign-in has not been configured for this user.",
      );
    }
    return null;
  }

  async getConfig() {
    const { enablePassword, enableRegistrationPassword, validateEmail } =
      await this.configService.get(CONFIG_NAMESPACE);
    return {
      enablePassword,
      enableRegistrationPassword,
      validateEmail,
    };
  }
}
