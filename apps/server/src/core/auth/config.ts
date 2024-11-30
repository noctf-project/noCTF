export type Config = {
  enableRegistrationPassword?: boolean;
  enablePassword?: boolean;
  enableOauth?: boolean;
  validateEmail?: boolean;
};

export const CONFIG_NAMESPACE = "core.auth";

export const DEFAULT_CONFIG: Config = {
  enableRegistrationPassword: true,
  enablePassword: true,
  enableOauth: true,
  validateEmail: false,
};
