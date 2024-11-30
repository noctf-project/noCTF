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

export class HCaptchaProvider implements CaptchaProvider {
  async validate(
    privateKey: string,
    response: string,
    clientIp: string,
  ): Promise<number> {
    const result = await ky
      .post("https://api.hcaptcha.com/siteverify", {
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
    return "hcaptcha";
  }
}
