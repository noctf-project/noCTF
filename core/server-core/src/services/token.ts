import { TokenValidationError } from "../errors.ts";
import { SerializableMap } from "@noctf/util/types";
import jwt from "jsonwebtoken";
import { CacheClient } from "../clients/cache.ts";
import { nanoid } from "nanoid";

type Props = {
  secret: string;
  cacheClient: CacheClient;
};

export class TokenService {
  private secret: Props["secret"];
  private cacheClient: Props["cacheClient"];

  constructor({ secret, cacheClient }: Props) {
    this.secret = secret;
    this.cacheClient = cacheClient;
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

  async validate<T extends { jti: string }>(
    token: string,
    audience?: string,
  ): Promise<T> {
    try {
      const data = jwt.verify(token, this.secret, {
        audience,
        algorithms: ["HS256"],
      }) as T;
      const ttl = await this.cacheClient.getTtl(`core:token:rev:${data.jti}`);
      if (ttl === -1 || ttl > 0) {
        throw new TokenValidationError("Token has been revoked");
      }
      return data;
    } catch (e) {
      if (e instanceof jwt.TokenExpiredError) {
        throw new TokenValidationError("Token has expired");
      } else if (e instanceof jwt.JsonWebTokenError) {
        throw new TokenValidationError("Token has invalid properties");
      }
      throw e;
    }
  }
}
