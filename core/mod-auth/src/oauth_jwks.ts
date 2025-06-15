import type { KeyService } from "@noctf/server-core/services/key";
import { CryptoKey, importJWK, JWK } from "jose";
import { createHash } from "node:crypto";

const EPOCH_SECONDS = 2 * 86400;

export class JWKSStore {
  private readonly secret;
  private keys: { pub: JWK; secret: CryptoKey }[];
  private epoch: number;

  constructor(private readonly keyService: KeyService) {
    this.secret = this.keyService.deriveKey("auth:jwks");
  }

  async getSigningKey() {
    return (await this.getKeys())[0];
  }

  async getPublicKeys() {
    return (await this.getKeys()).map(({ pub }) => pub);
  }

  private async getKeys() {
    const epoch =
      Math.floor(Date.now() / (1000 * EPOCH_SECONDS)) * EPOCH_SECONDS;
    if (epoch !== this.epoch) {
      // regenerate to avoid races
      this.keys = [
        await this.generateKey(epoch),
        await this.generateKey(epoch + EPOCH_SECONDS),
      ];
      this.epoch = epoch;
    }
    return this.keys;
  }

  private async generateKey(epoch: number) {
    const key = this.keyService.deriveEd25519Key(`jwks:key:${epoch}`);
    const kid = createHash("sha256")
      .update(key.publicKey)
      .digest()
      .subarray(0, 20)
      .toString("base64url");
    const secret = {
      kty: "OKP",
      crv: "Ed25519",
      d: Buffer.from(key.secretKey.slice(0, 32)).toString("base64url"),
      x: Buffer.from(key.secretKey.slice(32, 64)).toString("base64url"),
      use: "sig",
      alg: "EdDSA",
    };
    const pub = {
      kid,
      kty: secret.kty,
      crv: secret.crv,
      x: secret.x,
      alg: secret.alg,
      use: secret.use,
    };
    return { pub, secret: (await importJWK(secret)) as CryptoKey };
  }
}
