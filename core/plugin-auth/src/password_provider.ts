import { IdentityProvider } from "@noctf/server-core/providers/identity";
import { ConfigService } from "@noctf/server-core/services/config";
import { CONFIG_NAMESPACE } from "./config.ts";
import { AuthMethod } from "@noctf/api/datatypes";
import { IdentityService } from "@noctf/server-core/services/identity";
import {
  AuthProviderNotFound,
  AuthenticationError,
} from "@noctf/server-core/errors";
import { AuthRegisterToken } from "@noctf/api/token";

export class PasswordProvider implements IdentityProvider {
  constructor(
    private configService: ConfigService,
    private identityService: IdentityService,
  ) {}

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
      throw new AuthProviderNotFound();
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

  private async getConfig() {
    const { enablePassword, enableRegistrationPassword, validateEmail } =
      await this.configService.get(CONFIG_NAMESPACE);
    return {
      enablePassword,
      enableRegistrationPassword,
      validateEmail,
    };
  }
}
