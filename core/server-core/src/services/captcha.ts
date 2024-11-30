import type { ServiceCradle } from "../index.ts";

type Props = Pick<ServiceCradle, "configService">;

export class CaptchaService {
  private readonly configService: Props["configService"];

  constructor({ configService }: Props) {
    this.configService = configService;
  }
}
