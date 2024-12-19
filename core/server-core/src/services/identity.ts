import { AuthMethod } from "@noctf/api/datatypes";
import { AuthToken, AuthTokenType } from "@noctf/api/token";

import { ConflictError, ValidationError } from "../errors.ts";
import { IdentityProvider, UpdateIdentityData } from "../types/identity.ts";
import type { ServiceCradle } from "../index.ts";

type Props = Pick<
  ServiceCradle,
  "databaseClient" | "tokenService" | "cacheService"
>;

const CACHE_NAMESPACE = "core:svc:identity";

export class IdentityService {
  private readonly databaseClient;
  private readonly tokenService;
  private readonly cacheService;

  private providers: Map<string, IdentityProvider> = new Map();

  constructor({ databaseClient, tokenService, cacheService }: Props) {
    this.databaseClient = databaseClient;
    this.tokenService = tokenService;
    this.cacheService = cacheService;
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
    switch (result.aud) {
      case "session":
        return this.tokenService.sign(
          { sub: result.sub },
          "session",
          24 * 3600 * 7,
        );
      case "scoped":
        return this.tokenService.sign({ sub: result.sub }, "scoped", 2 * 3600);
      case "associate":
      case "register":
        return this.tokenService.sign(
          { roles: result.roles, identity: result.identity },
          result.aud,
          30 * 60,
        );
      default:
        throw new ValidationError("invalid token type");
    }
  }

  async validateToken<T extends AuthToken>(
    token: string,
    types: AuthTokenType | AuthTokenType[],
  ) {
    return this.tokenService.validate(
      token,
      Array.isArray(types) ? types : [types],
    ) as unknown as Promise<T>;
  }

  async revokeToken(token: string, audience?: AuthTokenType | AuthTokenType[]) {
    return this.tokenService.revoke(token, audience);
  }

  async associateIdentity(data: UpdateIdentityData) {
    const result = await this.databaseClient
      .get()
      .selectFrom("core.user_identity")
      .select(["user_id"])
      .where("provider", "=", data.provider)
      .where("provider_id", "=", data.provider_id)
      .executeTakeFirst();
    if (!result) {
      await this.databaseClient
        .get()
        .insertInto("core.user_identity")
        .values([data])
        .executeTakeFirst();
      return;
    } else if (data.user_id && data.user_id !== result?.user_id) {
      throw new ConflictError(
        "The identity is already bound to a different user",
      );
    }

    await this.databaseClient
      .get()
      .updateTable("core.user_identity")
      .where("user_id", "=", data.user_id)
      .where("provider", "=", data.provider)
      .set(data)
      .executeTakeFirst();
  }

  async removeIdentity(userId: number, provider: string) {
    await this.databaseClient
      .get()
      .deleteFrom("core.user_identity")
      .where("user_id", "=", userId)
      .where("provider", "=", provider)
      .executeTakeFirst();
  }

  async listProvidersForUser(id: number) {
    return await this.databaseClient
      .get()
      .selectFrom("core.user_identity")
      .select(["provider", "provider_id"])
      .where("user_id", "=", id)
      .execute();
  }

  async getProviderForUser(name: string, id: number) {
    return this.cacheService.load(
      CACHE_NAMESPACE,
      `pid_usr:${id}:${name}`,
      async () =>
        await this.databaseClient
          .get()
          .selectFrom("core.user_identity")
          .select([
            "user_id",
            "provider",
            "provider_id",
            "secret_data",
            "created_at",
          ])
          .where("provider", "=", name)
          .where("user_id", "=", id)
          .executeTakeFirst(),
    );
  }

  async getIdentityForProvider(name: string, id: string) {
    return this.cacheService.load(
      CACHE_NAMESPACE,
      `uid_pvd:${id}:${name}`,
      async () =>
        await this.databaseClient
          .get()
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
          .executeTakeFirst(),
    );
  }
}
