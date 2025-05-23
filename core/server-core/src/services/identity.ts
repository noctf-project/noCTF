import type { AuthMethod, UserIdentity } from "@noctf/api/datatypes";
import type { AuthToken, AuthTokenType } from "@noctf/api/token";
import { createHash } from "node:crypto";

import { TokenInvalidatedError, TokenValidationError } from "../errors.ts";
import type { ServiceCradle } from "../index.ts";
import { UserIdentityDAO } from "../dao/user_identity.ts";
import { LocalCache } from "../util/local_cache.ts";
import { EncryptJWT, jwtDecrypt } from "jose";
import { JOSEError, JWTExpired } from "jose/errors";

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

  private readonly revocationCache = new LocalCache<string, boolean>({
    max: 10000,
    ttl: 5000,
  });

  private providers: Map<string, IdentityProvider> = new Map();

  constructor({ databaseClient, cacheService, secret }: Props) {
    this.databaseClient = databaseClient;
    this.cacheService = cacheService;
    this.secret = createHash("sha256").update(secret).digest();
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

  async createSession({
    app_id,
    user_id,
    scopes,
  }: {
    app_id?: number;
    user_id: number;
    scopes?: string[];
  }) {
    return this.generateToken({
      sub: user_id.toString(),
      app: app_id?.toString(),
      scopes,
      sid: "1", // TODO
    });
  }

  private async generateToken(result: Omit<AuthToken, "exp">): Promise<string> {
    return await new EncryptJWT(result)
      .setAudience(AUDIENCE)
      .setExpirationTime("7d") // TODO: shorten this
      .setProtectedHeader({ alg: "dir", enc: "A128CBC-HS256" })
      .setIssuer("noctf")
      .setIssuedAt()
      .encrypt(this.secret);
  }

  async validateToken(token: string): Promise<AuthToken> {
    try {
      const data = await jwtDecrypt<AuthToken>(token, this.secret, {
        audience: AUDIENCE,
        contentEncryptionAlgorithms: ["A128CBC-HS256"],
      });
      console.log(data);

      const checkRevoke = () =>
        this.cacheService
          .getTtl(REVOKE_NS, data.payload.sid)
          .then((t) => t === -1 || t > 0);

      // cache non revoked tokens for a bit to avoid hitting server. cache revoked tokens for the
      // full duration
      const revoked = await this.revocationCache.load(
        data.payload.sid,
        checkRevoke,
        (v) =>
          v
            ? data.payload.exp
              ? { ttl: data.payload.exp * 1000 - Date.now() }
              : undefined
            : { ttl: 1000 },
      );
      if (revoked) {
        throw new TokenInvalidatedError("Token has been revoked");
      }
      return data.payload;
    } catch (e) {
      if (e instanceof JWTExpired) {
        throw new TokenInvalidatedError("Token has expired");
      } else if (e instanceof JOSEError) {
        throw new TokenValidationError("Token is invalid");
      }
      throw e;
    }
  }

  async revokeToken(token: string) {
    let sid: string | undefined;
    let exp: number | undefined;
    try {
      const payload = await this.validateToken(token);
      sid = payload.sid;
      exp = payload.exp;
    } catch (e) {
      if (e instanceof TokenInvalidatedError) {
        throw e;
      }
    }
    if (!sid) {
      // TODO: assume it's a refresh token and lookup the sid in DB
      sid = "100";
    }
    // This shouldn't happen
    if (!exp) {
      exp = Math.floor(Date.now() / 1000) + 24 * 7 * 3600;
    }
    this.cacheService.put(
      REVOKE_NS,
      sid,
      1,
      exp - Math.floor(Date.now() / 1000),
    );
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
