export type Config = {
  enablePassword?: boolean;
  enableOauth?: boolean;
  validateEmail?: boolean;
};

export const CONFIG_NAMESPACE = "core.auth";

export const DEFAULT_CONFIG: Config = {
  enablePassword: true,
  enableOauth: true,
  validateEmail: false,
};
