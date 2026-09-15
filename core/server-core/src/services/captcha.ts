import { CaptchaConfig } from "@noctf/api/config";
import { ValidationError } from "../errors.ts";
import type { ServiceCradle } from "../index.ts";
import ky from "ky";

type Props = Pick<ServiceCradle, "configService">;

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
    const res = await ky.post(this.verifyURL, {
      body: new URLSearchParams({
        response,
        remoteip: clientIp,
        secret: privateKey,
      }),
    });
    const result = await res.json<{ success: boolean; challenge_ts: string }>();
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

export class CaptchaService {
  private readonly configService: Props["configService"];
  private readonly providers: Map<string, CaptchaProvider> = new Map();

  constructor({ configService }: Props) {
    this.configService = configService;
    void configService.register(
      CaptchaConfig,
      { routes: [] },
      this.validateConfig.bind(this),
    );
  }

  register(provider: CaptchaProvider) {
    if (this.providers.has(provider.id())) {
      throw new Error(`Provider ${provider.id()} has already been registered`);
    }
    this.providers.set(provider.id(), provider);
  }

  private validateConfig({ provider }: CaptchaConfig) {
    if (provider && !this.providers.has(provider)) {
      throw new Error(`Captcha provider ${provider} does not exist`);
    }
  }

  async getConfig(): Promise<CaptchaConfig> {
    return (await this.configService.get(CaptchaConfig)).value;
  }

  async validate(response: string, clientIp: string): Promise<number> {
    const { provider, private_key } = await this.getConfig();
    if (!provider) {
      // Pass validation if captcha is not configured
      return Date.now();
    }
    if (!this.providers.has(provider) || !private_key) {
      throw new Error(`Captcha provider ${provider} is not configured`);
    }
    return await this.providers
      .get(provider)!
      .validate(private_key, response, clientIp);
  }
}
