import type { AuthMethod, UserIdentity } from "@noctf/api/datatypes";
import type { AuthToken, AuthTokenType } from "@noctf/api/token";

import { ValidationError } from "../errors.ts";
import type { ServiceCradle } from "../index.ts";
import { UserIdentityDAO } from "../dao/user_identity.ts";
import type { VerifyOptions } from "./token.ts";

type Props = Pick<
  ServiceCradle,
  "databaseClient" | "tokenService" | "cacheService"
>;
export interface IdentityProvider {
  id(): string;
  listMethods(): Promise<AuthMethod[]>;
}

export type AssociateIdentity = Omit<UserIdentity, "created_at">;

const CACHE_NAMESPACE = "core:svc:identity";

export class IdentityService {
  private readonly databaseClient;
  private readonly tokenService;
  private readonly cacheService;
  private readonly dao;

  private providers: Map<string, IdentityProvider> = new Map();

  constructor({ databaseClient, tokenService, cacheService }: Props) {
    this.databaseClient = databaseClient;
    this.tokenService = tokenService;
    this.cacheService = cacheService;
    this.dao = new UserIdentityDAO();
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
    options?: Partial<VerifyOptions>,
  ) {
    return this.tokenService.validate(
      token,
      Array.isArray(types) ? types : [types],
      options,
    ) as unknown as Promise<T>;
  }

  async revokeToken(token: string, audience?: AuthTokenType | AuthTokenType[]) {
    return this.tokenService.revoke(token, audience);
  }

  async associateIdentity(data: AssociateIdentity) {
    return this.dao.associate(this.databaseClient.get(), data);
  }

  async removeIdentity(user_id: number, provider: string) {
    return this.dao.disAssociate(this.databaseClient.get(), {
      user_id,
      provider,
    });
  }

  async listProvidersForUser(id: number) {
    return this.dao.listProvidersForUser(this.databaseClient.get(), id);
  }

  async getProviderForUser(user_id: number, provider: string) {
    return this.cacheService.load(
      CACHE_NAMESPACE,
      `pvd_uid:${user_id}:${provider}`,
      async () =>
        await this.dao.getIdentityForUser(this.databaseClient.get(), {
          user_id,
          provider,
        }),
    );
  }

  async getIdentityForProvider(provider: string, provider_id: string) {
    return this.cacheService.load(
      CACHE_NAMESPACE,
      `uid_pvd:${provider}:${provider_id}`,
      async () =>
        await this.dao.getIdentityForProvider(this.databaseClient.get(), {
          provider,
          provider_id,
        }),
    );
  }
}
