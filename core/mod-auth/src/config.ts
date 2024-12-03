import { Static, Type } from "@sinclair/typebox";

export const Config = Type.Object({
  enable_register_password: Type.Boolean({
    title: "Enable registration with password",
  }),
  enable_login_password: Type.Boolean({
    title: "Enable login with password",
  }),
  enable_oauth: Type.Boolean({
    title: "Enable OAuth Integration",
    description:
      "Login and registation with specific providers can be disabled per provider.",
  }),
  validate_email: Type.Boolean({
    title: "Require validation of email",
  }),
});
export type Config = Static<typeof Config>;

export const CONFIG_NAMESPACE = "core.auth";
export const CACHE_NAMESPACE = "core:plugin-auth";

export const DEFAULT_CONFIG: Config = {
  enable_register_password: true,
  enable_login_password: true,
  enable_oauth: true,
  validate_email: false,
};
