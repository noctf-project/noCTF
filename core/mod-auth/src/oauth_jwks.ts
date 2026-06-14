import { getPublicKeyAsync } from "@noble/ed25519";
import type { KeyService } from "@noctf/server-core/services/key";
import { CryptoKey, importJWK, JWK } from "jose";
import { createHash } from "node:crypto";

type Jwk = { pub: JWK; secret: CryptoKey; not_before: number };

export class JWKSStore {
  private keys: Jwk[] = [];
  private readonly halfEpoch: number;

  constructor(
    private readonly keyService: KeyService,
    private epoch: number,
  ) {
    this.halfEpoch = Math.floor(epoch / 2);
  }

  async getSigningKey(): Promise<Jwk> {
    const keys = await this.ensureKeys();
    return keys.find((x) => x.not_before <= Date.now())!;
  }

  async getValidKeys() {
    return await this.ensureKeys();
  }

  getMaxMessageValidityMs() {
    return this.halfEpoch;
  }

  private async generateKey(not_before: number) {
    const key = this.keyService.deriveKey(`auth:jwk:${not_before}`);
    const secret = {
      kty: "OKP",
      crv: "Ed25519",
      d: key.toString("base64url"),
      x: Buffer.from(await getPublicKeyAsync(key)).toString("base64url"),
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
    return { pub, secret: (await importJWK(secret)) as CryptoKey, not_before };
  }

  private async ensureKeys() {
    const time = Date.now() - this.halfEpoch;
    const e1 = Math.floor(time / this.epoch) * this.epoch;
    const e2 = e1 + this.epoch;
    if (
      this.keys.length &&
      this.keys[0].not_before === e2 &&
      this.keys[1].not_before === e1
    ) {
      return this.keys;
    }
    this.keys = await Promise.all([e2, e1].map((e) => this.generateKey(e)));
    return this.keys;
  }
}
