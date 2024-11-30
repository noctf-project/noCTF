import { TokenValidationError } from "@noctf/server-api/errors";
import { SerializableMap } from "@noctf/server-api/types";
import jwt from "jsonwebtoken";

export class TokenService {
  constructor(private secret: string) {}

  sign(data: SerializableMap, audience: string, expirySeconds: number = 3600) {
    return jwt.sign(
      {
        ...data,
        iss: "noctf",
      },
      this.secret,
      {
        algorithm: "HS256",
        audience,
        expiresIn: expirySeconds,
      },
    );
  }

  verify(token: string, audience?: string) {
    try {
      return jwt.verify(token, this.secret, {
        audience,
        algorithms: ["HS256"],
      });
    } catch (e) {
      if (e instanceof jwt.TokenExpiredError) {
        throw new TokenValidationError("Token has expired");
      } else if (e instanceof jwt.JsonWebTokenError) {
        throw new TokenValidationError("Token has invalid properties");
      }
    }
  }
}
