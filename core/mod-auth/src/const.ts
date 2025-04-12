import type { AuthConfig } from "@noctf/api/config";
import Handlebars from "handlebars";

export const CACHE_NAMESPACE = "core:mod:auth";

export const DEFAULT_CONFIG: AuthConfig = {
  enable_register_password: true,
  enable_login_password: true,
  enable_oauth: true,
  validate_email: false,
};

export const EMAIL_VERIFICATION_TEMPLATE = Handlebars.compile(`Hello,
Thanks for creating an account.

Click the following link to continue with registration:
{{ root_url }}/auth/register?token={{ token }}
`);
