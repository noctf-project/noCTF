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

Someone tried to register for {{ ctf_name }} using your email address.

If it was you, please click the following link to continue with creating your account:
{{ root_url }}/auth/register?token={{ token }}
`);

export const EMAIL_CHANGE_TEMPLATE = Handlebars.compile(`Hello,

An email change request was made for {{ ctf_name }} using your email address.

If it was you, please click the following link to confirm your email address change:
{{ root_url }}/settings/account?token={{ token }}
`);

export const EMAIL_RESET_PASSWORD_TEMPLATE = Handlebars.compile(`Hello,

  Someone tried to reset your password for {{ ctf_name }} using your email address.
  
  If it was you, please click the following link to continue with creating your account:
  {{ root_url }}/auth/reset?token={{ token }}
  `);
