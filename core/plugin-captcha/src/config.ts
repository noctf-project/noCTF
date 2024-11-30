import { Static, Type } from "@sinclair/typebox";

export const CONFIG_NAMESPACE = "core.service.captcha";
export const CaptchaServiceConfig = Type.Object({
  provider: Type.Optional(Type.String()),
  public_key: Type.Optional(Type.String()),
  private_key: Type.Optional(Type.String()),
  routes: Type.Optional(Type.Array(Type.String())),
});
export type CaptchaServiceConfig = Static<typeof CaptchaServiceConfig>;

export const RESTRICTED_METHODS = new Set(["POST", "PUT", "DELETE"]);
