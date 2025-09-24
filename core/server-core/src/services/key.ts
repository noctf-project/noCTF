import { BinaryLike, createHash, createHmac } from "node:crypto";

export class KeyService {
  private readonly secret;

  constructor(secret: string) {
    if (secret.length < 32)
      throw new Error(
        "Cannot start key service, key is less than 32 characters",
      );
    this.secret = createHash("sha256").update(secret).digest();
  }

  deriveKey(payload: BinaryLike) {
    return createHmac("sha256", this.secret).update(payload).digest();
  }
}
