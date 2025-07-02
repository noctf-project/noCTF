import type { AuthMethod, UserIdentity } from "@noctf/api/datatypes";
import type { AuthToken } from "@noctf/api/token";
import { createHash } from "node:crypto";

import { TokenInvalidatedError, TokenValidationError } from "../errors.ts";
import type { ServiceCradle } from "../index.ts";
import { UserIdentityDAO } from "../dao/user_identity.ts";
import { LocalCache } from "../util/local_cache.ts";
import { EncryptJWT, jwtDecrypt } from "jose";
import { JOSEError, JWTExpired } from "jose/errors";
import { SessionDAO } from "../dao/session.ts";
import { nanoid } from "nanoid";
import { OAuthTokenResponse } from "@noctf/api/responses";

type Props = Pick<
  ServiceCradle,
  "databaseClient" | "cacheService" | "keyService"
>;
export interface IdentityProvider {
  id(): string;
  listMethods(): Promise<AuthMethod[]>;
}

export type AssociateIdentity = Omit<UserIdentity, "created_at">;

const ONE_WEEK_IN_SECONDS = 7 * 24 * 3600;

const AUDIENCE = "noctf:auth";
const REVOKE_NS = "core:identity:session:rev";

export class IdentityService {
  private readonly databaseClient;
  private readonly cacheService;
  private readonly identityDAO;
  private readonly sessionDAO;
  private readonly secret;

  private readonly revocationCache = new LocalCache<string, boolean>({
    max: 10000,
    ttl: 5000,
  });

  private providers: Map<string, IdentityProvider> = new Map();

  constructor({ databaseClient, cacheService, keyService }: Props) {
    this.databaseClient = databaseClient;
    this.cacheService = cacheService;
    this.secret = keyService.deriveKey("core:identity");
    this.identityDAO = new UserIdentityDAO(databaseClient.get());
    this.sessionDAO = new SessionDAO(databaseClient.get());
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

  async createSession(
    {
      app_id,
      user_id,
      scopes,
      ip,
    }: {
      app_id?: number;
      user_id: number;
      ip?: string;
      scopes?: string[];
    },
    generateRefreshToken = false,
  ): Promise<OAuthTokenResponse> {
    const refreshToken = generateRefreshToken ? nanoid() : undefined;
    const expires_at = app_id
      ? null
      : new Date(Date.now() + ONE_WEEK_IN_SECONDS * 1000); // 7 days for session tokens
    const sid = await this.sessionDAO.createSession({
      user_id,
      app_id,
      scopes,
      ip,
      expires_at,
      refresh_token_hash: refreshToken
        ? createHash("sha256").update(refreshToken).digest()
        : null,
    });

    // TODO: shorten this to 1 hour for all token types
    const expires_in = app_id ? 3600 : ONE_WEEK_IN_SECONDS;
    return {
      access_token: await this.generateToken(
        {
          sub: user_id.toString(),
          app: app_id?.toString(),
          scopes,
          sid: sid.toString(),
        },
        expires_in,
      ),
      refresh_token: refreshToken,
      expires_in,
    };
  }

  async refreshSession(app_id: number | null, token: string) {
    const oldHash = createHash("sha256").update(token).digest();
    const refreshToken = nanoid();
    const newHash = createHash("sha256").update(refreshToken).digest();
    const {
      id: sid,
      user_id,
      expires_at,
      revoked_at,
      scopes,
    } = await this.sessionDAO.refreshSession(app_id, oldHash, newHash);
    let tokenExpires = new Date(Date.now() + ONE_WEEK_IN_SECONDS);
    if (expires_at && expires_at < tokenExpires) tokenExpires = expires_at;
    if (revoked_at && revoked_at < tokenExpires) tokenExpires = revoked_at;

    return {
      access_token: await this.generateToken(
        {
          sub: user_id.toString(),
          app: app_id?.toString(),
          scopes: scopes || undefined,
          sid: sid.toString(),
        },
        tokenExpires,
      ),
      refresh_token: refreshToken,
    };
  }

  private async generateToken(
    result: Omit<AuthToken, "exp">,
    expires: number | Date = 3600,
  ): Promise<string> {
    return await new EncryptJWT(result)
      .setAudience(AUDIENCE)
      .setExpirationTime(
        expires instanceof Date
          ? expires
          : Math.floor(Date.now() / 1000) + expires,
      )
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
    let sid: number | undefined;
    let exp = Math.floor(Date.now() / 1000) + ONE_WEEK_IN_SECONDS;
    try {
      const payload = await this.validateToken(token);
      sid = +payload.sid;
      exp = payload.exp;
    } catch (e) {
      if (e instanceof TokenInvalidatedError) {
        throw e;
      }
    }
    // assume it's a refresh token
    if (!sid) {
      const { id, expires_at } = await this.sessionDAO.getByRefreshToken(
        createHash("sha256").update(token).digest(),
      );
      sid = id;
      if (expires_at && expires_at.getTime() < exp) exp = expires_at.getTime();
    }
    await Promise.all([
      this.sessionDAO.revokeSession(sid),
      this.cacheService.put(
        REVOKE_NS,
        sid.toString(),
        1,
        exp - Math.floor(Date.now() / 1000),
      ),
    ]);
  }

  async revokeUserSessions(user_id: number, app_id?: number) {
    const sessions = await this.sessionDAO.revokeUserSessions(user_id, app_id);
    await Promise.all(
      sessions.map(async ({ id, expires_at }) => {
        return this.cacheService.put(
          REVOKE_NS,
          id.toString(),
          1,
          expires_at
            ? Math.floor(expires_at.getTime() - Date.now())
            : ONE_WEEK_IN_SECONDS,
        );
      }),
    );
  }

  async associateIdentities(data: AssociateIdentity[]) {
    await this.databaseClient.transaction(async (tx) => {
      const dao = new UserIdentityDAO(tx);
      for (const d of data) {
        await dao.associate(d);
      }
    });
  }

  async removeIdentity(user_id: number, provider: string) {
    return this.identityDAO.disAssociate({
      user_id,
      provider,
    });
  }

  async listProvidersForUser(id: number) {
    return this.identityDAO.listProvidersForUser(id);
  }

  async getProviderForUser(user_id: number, provider: string) {
    return this.identityDAO.getIdentityForUser(user_id, provider);
  }

  async getIdentityForProvider(provider: string, provider_id: string) {
    return this.identityDAO.getIdentityForProvider({
      provider,
      provider_id,
    });
  }
}
