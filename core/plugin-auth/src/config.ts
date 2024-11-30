import { Static, Type } from "@sinclair/typebox";

export const Config = Type.Object({
  enableRegistrationPassword: Type.Optional(
    Type.Boolean({
      title: "Enable registration with password",
    }),
  ),
  enablePassword: Type.Optional(
    Type.Boolean({
      title: "Enable login with password",
    }),
  ),
  enableOauth: Type.Optional(
    Type.Boolean({
      title: "Enable login/registration with OAuth",
      description:
        "Login and registation with specific providers can be disabled per provider.",
    }),
  ),
  validateEmail: Type.Optional(
    Type.Boolean({
      title: "Require validation of email",
    }),
  ),
});
export type Config = Static<typeof Config>;

export const CONFIG_NAMESPACE = "core.auth";
export const CACHE_NAMESPACE = "core:plugin-auth";

export const DEFAULT_CONFIG: Config = {
  enableRegistrationPassword: true,
  enablePassword: true,
  enableOauth: true,
  validateEmail: false,
};
