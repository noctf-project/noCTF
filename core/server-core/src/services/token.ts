import { TokenValidationError } from "../errors.ts";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import type { ServiceCradle } from "../index.ts";
import { SerializableMap } from "../types/primitives.ts";

type Props = Pick<ServiceCradle, "cacheService" | "logger"> & {
  secret: string;
};

export class TokenService {
  private secret: Props["secret"];
  private cacheService: Props["cacheService"];
  private logger: Props["logger"];

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
        `core:token:rev:${data.jti}`,
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

  async validate<T extends { jti: string }>(
    token: string,
    audience?: string | string[],
    verifyRevocation = true,
  ): Promise<T> {
    try {
      const data = jwt.verify(token, this.secret, {
        audience,
        algorithms: ["HS256"],
      }) as T;
      if (!verifyRevocation) {
        return data;
      }
      const ttl = await this.cacheService.getTtl(`core:token:rev:${data.jti}`);
      if (ttl === -1 || ttl > 0) {
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
