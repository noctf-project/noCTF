import { IdentityProvider } from "@noctf/server-core/types/identity";
import { ConfigService } from "@noctf/server-core/services/config";
import { AuthMethod } from "@noctf/api/datatypes";
import { IdentityService } from "@noctf/server-core/services/identity";
import { NotFoundError, AuthenticationError } from "@noctf/server-core/errors";
import { AuthToken } from "@noctf/api/token";
import { Validate } from "./hash_util.ts";
import { Logger } from "@noctf/server-core/types/primitives";
import { ServiceCradle } from "@noctf/server-core";
import { AuthConfig } from "@noctf/api/config";
import { UserFlag } from "@noctf/server-core/types/enums";

type Props = Pick<
  ServiceCradle,
  "logger" | "configService" | "identityService"
>;

export class PasswordProvider implements IdentityProvider {
  private logger: Logger;
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
    if ((await this.getConfig()).enable_login_password) {
      return [
        {
          provider: "email",
        },
      ];
    }
    return [];
  }

  async authPreCheck(email: string): Promise<AuthToken | null> {
    const { enable_login_password, enable_register_password, validate_email } =
      await this.getConfig();
    if (!enable_login_password) {
      throw new NotFoundError("The requested auth provider cannot be found");
    }
    const identity = await this.identityService.getIdentityForProvider(
      this.id(),
      email,
    );
    if (!identity) {
      if (!enable_register_password) {
        throw new AuthenticationError(
          "New user registration is currently not available through this provider",
        );
      }
      return {
        aud: "register",
        identity: [
          {
            provider: "email",
            provider_id: email,
          },
        ],
        flags: validate_email ? [UserFlag.VALID_EMAIL] : [],
      };
    }
    if (identity.secret_data) {
      throw new AuthenticationError(
        "Password sign-in has not been configured for this user.",
      );
    }
    return null;
  }

  async authenticate(email: string, password: string): Promise<AuthToken> {
    const identity = await this.identityService.getIdentityForProvider(
      this.id(),
      email,
    );

    if (
      !identity ||
      !identity.secret_data ||
      !(await Validate(password, identity.secret_data))
    ) {
      throw new AuthenticationError("Incorrect email or password");
    }

    return {
      aud: "session",
      sub: identity.user_id,
    };
  }

  async getConfig() {
    const { enable_login_password, enable_register_password, validate_email } =
      (await this.configService.get<AuthConfig>(AuthConfig.$id)).value;
    return {
      enable_login_password,
      enable_register_password,
      validate_email,
    };
  }
}
