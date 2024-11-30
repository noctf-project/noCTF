import { AuthMethod } from "@noctf/api/datatypes";
import {
  AuthAssociateToken,
  AuthRegisterToken,
  AuthToken,
  AuthTokenType,
  AuthUserToken,
} from "@noctf/api/token";

import { DatabaseClient } from "../clients/database.ts";
import { ApplicationError, ValidationError } from "../errors.ts";
import { TokenService } from "./token.ts";
import { IdentityProvider, UpdateIdentityData } from "../providers/identity.ts";

type Props = {
  databaseClient: DatabaseClient;
  tokenService: TokenService;
};

export class IdentityService {
  private databaseClient: Props["databaseClient"];
  private tokenService: Props["tokenService"];

  private providers: Map<string, IdentityProvider> = new Map();

  constructor({ databaseClient, tokenService }: Props) {
    this.databaseClient = databaseClient;
    this.tokenService = tokenService;
  }

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

  generateToken(result: AuthToken): string {
    switch (result.type) {
      case "auth":
        return this.tokenService.sign(
          { sub: result.sub },
          "noctf/identity/auth",
          24 * 3600 * 7,
        );
      case "associate":
      case "register":
        return this.tokenService.sign(
          { flags: result.flags, identity: result.identity },
          `noctf/identity/${result.type}`,
          30 * 60,
        );
      default:
        throw new ValidationError("invalid token type");
    }
  }

  async validateToken(type: AuthTokenType, token: string) {
    switch (type) {
      case "auth":
        return this.tokenService.validate(
          token,
          `noctf/identity/auth`,
        ) as unknown as Promise<AuthUserToken>;
      case "associate":
      case "register":
        return this.tokenService.validate(
          token,
          `noctf/identity/${type}`,
        ) as unknown as Promise<AuthAssociateToken | AuthRegisterToken>;
      default:
        throw new ValidationError("invalid token type");
    }
  }

  async revokeToken(token: string) {
    return this.tokenService.revoke(token);
  }

  async associateIdentity(data: UpdateIdentityData) {
    const result = await this.databaseClient
      .selectFrom("core.user_identity")
      .select(["user_id"])
      .where("provider", "=", data.provider)
      .where("provider_id", "=", data.provider_id)
      .executeTakeFirst();
    if (!result) {
      await this.databaseClient
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

    await this.databaseClient
      .updateTable("core.user_identity")
      .where("user_id", "=", data.user_id)
      .where("provider", "=", data.provider)
      .set(data)
      .executeTakeFirst();
  }

  async removeIdentity(userId: number, provider: string) {
    await this.databaseClient
      .deleteFrom("core.user_identity")
      .where("user_id", "=", userId)
      .where("provider", "=", provider)
      .executeTakeFirst();
  }

  async listProvidersForUser(id: number) {
    return await this.databaseClient
      .selectFrom("core.user_identity")
      .select(["provider", "provider_id"])
      .where("user_id", "=", id)
      .execute();
  }

  async getProviderIdForUser(name: string, id: number) {
    return (
      await this.databaseClient
        .selectFrom("core.user_identity")
        .select(["provider_id"])
        .where("provider", "=", name)
        .where("user_id", "=", id)
        .executeTakeFirst()
    )?.provider_id;
  }

  async getIdentityForProvider(name: string, id: string) {
    return await this.databaseClient
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
