import type { ServiceCradle } from "../index.ts";
import { CaptchaProvider } from "../providers/captcha.ts";
import { ValidationError } from "../errors.ts";
import { Static, Type } from "@sinclair/typebox";

const CONFIG_NAMESPACE = "core.service.captcha";
export const CaptchaServiceConfig = Type.Object({
  provider: Type.Optional(Type.String()),
  public_key: Type.Optional(Type.String()),
  private_key: Type.Optional(Type.String()),
});
export type CaptchaServiceConfig = Static<typeof CaptchaServiceConfig>;

type Props = Pick<ServiceCradle, "configService">;

export class CaptchaService {
  private readonly configService: Props["configService"];
  private readonly providers: Map<string, CaptchaProvider> = new Map();

  constructor({ configService }: Props) {
    this.configService = configService;
    void configService.register(CONFIG_NAMESPACE, CaptchaServiceConfig, {});
    this.register(new DefaultCaptchaProvider("hcaptcha"));
  }

  register(provider: CaptchaProvider) {
    if (this.providers.has(provider.id())) {
      throw new Error(`Provider ${provider.id()} has already been registered`);
    }
    this.providers.set(provider.id(), provider);
  }

  async getProviderData(): Promise<{
    provider: string;
    public_key: string;
  } | null> {
    const { provider, public_key } =
      await this.configService.get<CaptchaServiceConfig>(CONFIG_NAMESPACE);
    if (!provider) {
      return null;
    }
    return { provider, public_key };
  }

  async validate(
    response: string,
    clientIp: string,
  ): Promise<[boolean, number]> {
    const { provider, private_key } =
      await this.configService.get<CaptchaServiceConfig>(CONFIG_NAMESPACE);
    if (!provider) {
      // Pass validation if captcha is not configured
      return [true, Date.now()];
    }
    if (!this.providers.has(provider) || !private_key) {
      throw new Error(`Captcha provider ${provider} is not configured.`);
    }
    await this.providers
      .get(provider)
      .validate(private_key, response, clientIp);
  }
}

export class DefaultCaptchaProvider implements CaptchaProvider {
  constructor(private readonly _id: string) {}

  async validate(
    privateKey: string,
    response: string,
    clientIp: string,
  ): Promise<[boolean, number]> {
    throw new ValidationError("Method not implemented.");
  }

  id() {
    return this._id;
  }
}
