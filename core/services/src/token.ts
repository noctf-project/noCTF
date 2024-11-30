import { Serializable } from "@noctf/server-api/types";
import { sign } from "jsonwebtoken";

export class TokenService {
  constructor(private secret: string) {}

  sign(audience: string, subject: Serializable, expirySeconds: number = 3600) {
    return sign(
      {
        audience,
        iss: "noctf",
        sub: subject,
      },
      this.secret,
      {
        algorithm: "HS256",
        expiresIn: expirySeconds,
      },
    );
  }
}
