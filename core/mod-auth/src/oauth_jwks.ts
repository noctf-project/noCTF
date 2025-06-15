import type { KeyService } from "@noctf/server-core/services/key";
import { CryptoKey, importJWK, JWK } from "jose";
import { createHash } from "node:crypto";

const EPOCH_SECONDS = 86400;

export class JWKSStore {
  private key: { pub: JWK; secret: CryptoKey };

  constructor(private readonly keyService: KeyService) {}

  async getKey() {
    if (!this.key) {
      this.key = await this.generateKey();
    }
    return this.key;
  }

  private async generateKey() {
    const key = this.keyService.deriveEd25519Key("auth:jwk");
    const secret = {
      kty: "OKP",
      crv: "Ed25519",
      d: Buffer.from(key.secretKey.slice(0, 32)).toString("base64url"),
      x: Buffer.from(key.secretKey.slice(32, 64)).toString("base64url"),
      use: "sig",
      alg: "EdDSA",
    };
    const pub = {
      kid: createHash("sha256")
        .update(secret.x)
        .digest()
        .subarray(0, 20)
        .toString("base64url"),
      kty: secret.kty,
      crv: secret.crv,
      x: secret.x,
      alg: secret.alg,
      use: secret.use,
    };
    return { pub, secret: (await importJWK(secret)) as CryptoKey };
  }
}
