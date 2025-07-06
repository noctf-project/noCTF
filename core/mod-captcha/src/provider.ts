import { ValidationError } from "@noctf/server-core/errors";
import ky from "ky";

export interface CaptchaProvider {
  id(): string;
  validate(
    privateKey: string,
    response: string,
    clientIp?: string,
  ): Promise<number>;
}

export abstract class BaseSiteVerifyCaptchaProvider implements CaptchaProvider {
  constructor(
    private readonly _id: string,
    private readonly verifyURL: string,
  ) {}

  async validate(
    privateKey: string,
    response: string,
    clientIp: string,
  ): Promise<number> {
    const result = await ky
      .post(this.verifyURL, {
        body: new URLSearchParams({
          response,
          remoteip: clientIp,
          secret: privateKey,
        }),
      })
      .json<{ success: boolean; challenge_ts: string }>();
    if (!result.success) {
      throw new ValidationError("CAPTCHA failed validation");
    }
    return new Date(result.challenge_ts).valueOf();
  }

  id() {
    return this._id;
  }
}

export class HCaptchaProvider extends BaseSiteVerifyCaptchaProvider {
  constructor() {
    super("hcaptcha", "https://api.hcaptcha.com/siteverify");
  }
}

export class CloudflareCaptchaProvider extends BaseSiteVerifyCaptchaProvider {
  constructor() {
    super(
      "cloudflare",
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
  }
}
