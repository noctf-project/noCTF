import type { CaptchaProvider } from "./provider.ts";
import type { ServiceCradle } from "@noctf/server-core";
import { CaptchaConfig } from "@noctf/api/config";

type Props = Pick<ServiceCradle, "configService">;

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
    return (await this.configService.get<CaptchaConfig>(CaptchaConfig.$id))
      .value;
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
    await this.providers
      .get(provider)
      .validate(private_key, response, clientIp);
  }
}
