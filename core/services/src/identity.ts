import { AuthMethod, AuthTokenType } from "@noctf/api/ts/datatypes";
import { AuthResult, IdentityProvider } from "@noctf/server-api/identity";
import { DatabaseService } from "./database.ts";
import { ApplicationError } from "@noctf/server-api/errors";
import { TokenService } from "./token.ts";
import { UpdateIdentityData } from "@noctf/server-api/types";

export class IdentityService {
  private providers: Map<string, IdentityProvider> = new Map();

  constructor(
    private databaseService: DatabaseService,
    private tokenService: TokenService,
  ) {}

  register(provider: IdentityProvider) {
    if (this.providers.has(provider.id())) {
      throw new Error(`Provider ${provider.id()} has already been registered`);
    }
    this.providers.set(provider.id(), provider);
  }

  async listMethods(): Promise<AuthMethod[]> {
    const promises = Array.from(this.providers.values()).map((provider) =>
      provider.listMethods(),
    );
    return (await Promise.all(promises)).flatMap((v) => v);
  }

  generateToken(type: AuthTokenType, result: AuthResult): string {
    switch (type) {
      case "auth":
        return this.tokenService.sign(
          {
            sub: result,
          },
          "noctf/identity/auth",
          24 * 3600 * 7,
        );
      case "associate":
      case "register":
        return this.tokenService.sign(
          {
            dat: result,
          },
          `noctf/identity/${type}`,
          10 * 60,
        );
    }
  }

  async associateIdentity(data: UpdateIdentityData) {
    const result = await this.databaseService
      .selectFrom("core.user_identity")
      .select(["user_id"])
      .where("provider", "=", data.provider)
      .where("provider_id", "=", data.provider_id)
      .executeTakeFirst();
    if (!result) {
      await this.databaseService
        .insertInto("core.user_identity")
        .values([data])
        .executeTakeFirst();
      return;
    } else if (data.user_id && data.user_id !== result?.user_id) {
      throw new ApplicationError(
        409,
        "IdentityExistsForDifferentUser",
        "The identity is already bound to a different user",
      );
    }

    await this.databaseService
      .updateTable("core.user_identity")
      .where("user_id", "=", data.user_id)
      .where("provider", "=", data.provider)
      .set(data)
      .executeTakeFirst();
  }

  async removeIdentity(userId: number, provider: string) {
    await this.databaseService
      .deleteFrom("core.user_identity")
      .where("user_id", "=", userId)
      .where("provider", "=", provider)
      .executeTakeFirst();
  }

  async listProvidersForUser(id: number) {
    return await this.databaseService
      .selectFrom("core.user_identity")
      .select(["provider", "provider_id"])
      .where("user_id", "=", id)
      .execute();
  }

  async getProviderIdForUser(name: string, id: number) {
    return (
      await this.databaseService
        .selectFrom("core.user_identity")
        .select(["provider_id"])
        .where("provider", "=", name)
        .where("user_id", "=", id)
        .executeTakeFirst()
    )?.provider_id;
  }

  async getIdentityForProvider(name: string, id: string) {
    return await this.databaseService
      .selectFrom("core.user_identity")
      .select([
        "user_id",
        "provider",
        "provider_id",
        "secret_data",
        "created_at",
      ])
      .where("provider", "=", name)
      .where("provider_id", "=", id)
      .executeTakeFirst();
  }
}
