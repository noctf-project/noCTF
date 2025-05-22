import jwt from "jsonwebtoken";
import type { AuthMethod, UserIdentity } from "@noctf/api/datatypes";
import type { AuthToken, AuthTokenType } from "@noctf/api/token";

import { TokenValidationError } from "../errors.ts";
import type { ServiceCradle } from "../index.ts";
import { UserIdentityDAO } from "../dao/user_identity.ts";
import { LocalCache } from "../util/local_cache.ts";

type Props = Pick<ServiceCradle, "databaseClient" | "cacheService"> & {
  secret: string;
};
export interface IdentityProvider {
  id(): string;
  listMethods(): Promise<AuthMethod[]>;
}

export type AssociateIdentity = Omit<UserIdentity, "created_at">;

const CACHE_NAMESPACE = "core:svc:identity";
const AUDIENCE = "noctf:auth";
const REVOKE_NS = "core:identity:session:rev";

export class IdentityService {
  private readonly databaseClient;
  private readonly cacheService;
  private readonly secret;
  private readonly dao;

  private readonly revocationCache = new LocalCache<number, boolean>({
    max: 10000,
    ttl: 5000,
  });

  private providers: Map<string, IdentityProvider> = new Map();

  constructor({ databaseClient, cacheService, secret }: Props) {
    this.databaseClient = databaseClient;
    this.cacheService = cacheService;
    this.secret = secret;
    this.dao = new UserIdentityDAO(databaseClient.get());
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

  generateToken(result: Omit<AuthToken, "exp">): string {
    return jwt.sign(
      {
        ...result,
        iss: "noctf",
      },
      this.secret,
      {
        algorithm: "HS256",
        audience: AUDIENCE,
        expiresIn: 3600,
      },
    );
  }

  async validateToken(token: string) {
    try {
      const data = jwt.verify(token, this.secret, {
        audience: AUDIENCE,
        algorithms: ["HS256"],
      }) as unknown as AuthToken;

      const checkRevoke = () =>
        this.cacheService
          .getTtl(REVOKE_NS, data.sid.toString())
          .then((t) => t === -1 || t > 0);

      // cache non revoked tokens for a bit to avoid hitting server. cache revoked tokens for the
      // full duration
      const revoked = await this.revocationCache.load(
        data.sid,
        checkRevoke,
        (v) =>
          v
            ? data.exp
              ? { ttl: data.exp * 1000 - Date.now() }
              : undefined
            : { ttl: 1000 },
      );
      if (revoked) {
        throw new TokenValidationError("Token has been revoked");
      }
      return data;
    } catch (e) {
      if (e instanceof jwt.TokenExpiredError) {
        throw new TokenValidationError("Token has expired");
      } else if (e instanceof jwt.JsonWebTokenError) {
        throw new TokenValidationError("Token is invalid");
      }
      throw e;
    }
  }

  async revokeToken(token: string, audience?: AuthTokenType | AuthTokenType[]) {
    // TODO: revoke
  }

  async associateIdentities(data: AssociateIdentity[]) {
    return this.databaseClient.transaction(async (tx) => {
      const dao = new UserIdentityDAO(tx);
      for (const d of data) {
        await dao.associate(d);
      }
    });
  }

  async removeIdentity(user_id: number, provider: string) {
    return this.dao.disAssociate({
      user_id,
      provider,
    });
  }

  async listProvidersForUser(id: number) {
    return this.dao.listProvidersForUser(id);
  }

  async getProviderForUser(user_id: number, provider: string) {
    return this.cacheService.load(
      CACHE_NAMESPACE,
      `pvd_uid:${user_id}:${provider}`,
      async () => await this.dao.getIdentityForUser(user_id, provider),
    );
  }

  async getIdentityForProvider(provider: string, provider_id: string) {
    return this.cacheService.load(
      CACHE_NAMESPACE,
      `uid_pvd:${provider}:${provider_id}`,
      async () =>
        await this.dao.getIdentityForProvider({
          provider,
          provider_id,
        }),
    );
  }
}
