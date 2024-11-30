import { IdentityProvider } from "@noctf/server-api/identity";
import { ConfigService } from "@noctf/services/config";
import { DatabaseService } from "@noctf/services/database";
import { CONFIG_NAMESPACE, Config } from "./config";
import { AuthMethod } from "@noctf/api/ts/datatypes";

export class PasswordProvider implements IdentityProvider {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
  ) {}

  id(): string {
    return "email";
  }

  async listMethods(): Promise<AuthMethod[]> {
    if (await this.isEnabled()) {
      return [
        {
          provider: "email",
        },
      ];
    }
    return [];
  }

  private async isEnabled(): Promise<Boolean> {
    return !!(await this.configService.get<Config>(CONFIG_NAMESPACE))
      .enablePassword;
  }
}
