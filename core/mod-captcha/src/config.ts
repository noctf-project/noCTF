import { Static, Type } from "@sinclair/typebox";

export const CONFIG_NAMESPACE = "core.captcha";
export const CaptchaServiceConfig = Type.Object({
  provider: Type.Optional(
    Type.String({
      title: "CAPTCHA Provider",
      description: "Set to an empty string to disable",
    }),
  ),
  public_key: Type.Optional(
    Type.String({
      title: "Provider Public Key",
    }),
  ),
  private_key: Type.Optional(
    Type.String({
      title: "Provider Private Key",
    }),
  ),
  routes: Type.Array(
    Type.String({
      title: "Protected routes",
    }),
  ),
});
export type CaptchaServiceConfig = Static<typeof CaptchaServiceConfig>;

export const RESTRICTED_METHODS = new Set(["POST", "PUT", "DELETE"]);
