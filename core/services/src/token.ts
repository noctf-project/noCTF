import { Serializable } from "@noctf/server-api/types";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";

export class TokenService {
  constructor(private secret: string) {}

  sign(audience: string, subject: Serializable, expirySeconds: number = 3600) {
    return jwt.sign(
      {
        audience,
        iss: "noctf",
        sub: subject,
        jti: nanoid(),
      },
      this.secret,
      {
        algorithm: "HS256",
        expiresIn: expirySeconds,
      },
    );
  }
}
