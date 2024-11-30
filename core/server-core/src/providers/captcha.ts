export interface CaptchaProvider {
  id(): string;
  validate(
    privateKey: string,
    response: string,
    clientIp?: string,
  ): Promise<[boolean, number]>;
}
