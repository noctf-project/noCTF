import { CaptchaProvider } from "./provider.ts";
import { ServiceCradle } from "@noctf/server-core";
import { CaptchaServiceConfig, CONFIG_NAMESPACE } from "./config.ts";

type Props = Pick<ServiceCradle, "configService">;

export class CaptchaService {
  private readonly configService: Props["configService"];
  private readonly providers: Map<string, CaptchaProvider> = new Map();

  constructor({ configService }: Props) {
    this.configService = configService;
    void configService.register(
      CONFIG_NAMESPACE,
      CaptchaServiceConfig,
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

  private validateConfig({ provider }: CaptchaServiceConfig) {
    if (provider && !this.providers.has(provider)) {
      return `Captcha provider ${provider} does not exist`;
    }
    return null;
  }

  async getConfig(): Promise<CaptchaServiceConfig> {
    return (
      await this.configService.get<CaptchaServiceConfig>(CONFIG_NAMESPACE)
    ).value;
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
