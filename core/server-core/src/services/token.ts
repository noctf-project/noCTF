import { TokenValidationError } from "../errors.ts";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import type { ServiceCradle } from "../index.ts";
import type { SerializableMap } from "../types/primitives.ts";
import { LocalCache } from "../util/local_cache.ts";

type Props = Pick<ServiceCradle, "cacheService" | "logger"> & {
  secret: string;
};

export type VerifyOptions = {
  verifyRevocation: boolean;
  localVerifyRevocation: boolean;
};

const DEFAULT_VERIFY_OPTIONS: VerifyOptions = {
  verifyRevocation: true,
  localVerifyRevocation: false,
};

const REVOKE_NS = "core:token:rev";
export class TokenService {
  private secret: Props["secret"];
  private cacheService: Props["cacheService"];
  private logger: Props["logger"];
  private localCache = new LocalCache<string, boolean>({
    max: 10000,
    ttl: 1000,
  });

  constructor({ secret, cacheService: cacheService, logger }: Props) {
    this.secret = secret;
    this.cacheService = cacheService;
    this.logger = logger;
  }

  sign(data: SerializableMap, audience: string, expirySeconds: number = 3600) {
    return jwt.sign(
      {
        ...data,
        iss: "noctf",
        jti: nanoid(),
      },
      this.secret,
      {
        algorithm: "HS256",
        audience,
        expiresIn: expirySeconds,
      },
    );
  }

  async revoke(token: string, audience?: string | string[]) {
    try {
      const data = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
        audience,
      }) as { jti: string; exp: number };

      // Set a record in the cache with an extra 60 second buffer to account for clock skew
      await this.cacheService.put(
        REVOKE_NS,
        data.jti,
        1,
        data.exp - Math.floor(Date.now() / 1000) + 60 || 60,
      );
    } catch (e) {
      if (e instanceof jwt.JsonWebTokenError) {
        this.logger.debug("error validating token for expiry", e);
        return;
      }
      throw e;
    }
  }

  async validate<T extends { jti: string; exp: number }>(
    token: string,
    audience?: string | string[],
    options?: Partial<VerifyOptions>,
  ): Promise<T> {
    const opts = {
      ...DEFAULT_VERIFY_OPTIONS,
      ...options,
    };
    try {
      const data = jwt.verify(token, this.secret, {
        audience,
        algorithms: ["HS256"],
      }) as T;
      if (!opts.verifyRevocation) {
        return data;
      }

      const checkRevoke = () =>
        this.cacheService
          .getTtl(REVOKE_NS, data.jti)
          .then((t) => t === -1 || t > 0);
      let revoked;
      if (!data.jti) {
        revoked = false;
      } else if (opts.localVerifyRevocation) {
        revoked = await this.localCache.load(
          data.jti,
          checkRevoke,
          (v) => (v && data.exp) ? { ttl: data.exp * 1000 - Date.now() } : undefined,
        );
      } else {
        revoked = await checkRevoke();
      }
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
}
