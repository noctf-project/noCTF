import { AuthConfig } from "@noctf/api/config";

export const CACHE_NAMESPACE = "core:mod:auth";

export const DEFAULT_CONFIG: AuthConfig = {
  enable_register_password: true,
  enable_login_password: true,
  enable_oauth: true,
  validate_email: false,
};
