import type { ConfigService } from "@noctf/server-core/services/config";
import type { AuthMethod } from "@noctf/api/datatypes";
import type {
  IdentityProvider,
  IdentityService,
} from "@noctf/server-core/services/identity";
import { NotFoundError, AuthenticationError } from "@noctf/server-core/errors";
import type { AuthToken } from "@noctf/api/token";
import { Validate } from "./hash_util.ts";
import type { ServiceCradle } from "@noctf/server-core";
import { AuthConfig } from "@noctf/api/config";
import { UserNotFoundError } from "./error.ts";

type Props = Pick<ServiceCradle, "configService" | "identityService">;

export class PasswordProvider implements IdentityProvider {
  private configService: ConfigService;
  private identityService: IdentityService;

  constructor({ configService, identityService }: Props) {
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

  async authPreCheck(email: string): Promise<void> {
    const { enable_login_password, enable_register_password } =
      await this.getConfig();
    if (!enable_login_password) {
      throw new NotFoundError("The requested auth provider cannot be found");
    }
    const identity = await this.identityService.getIdentityForProvider(
      this.id(),
      email,
    );
    if (!identity) {
      throw new UserNotFoundError();
    }
    if (!identity.secret_data) {
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
