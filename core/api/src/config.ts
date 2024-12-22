import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import { TypeDate } from "./datatypes.ts";

export const TeamConfig = Type.Object(
  {
    max_members: Type.Number({
      title: "Maximum number of members in a team.",
    }),
  },
  { $id: "core.team", additionalProperties: false },
);
export type TeamConfig = Static<typeof TeamConfig>;

export const AuthConfig = Type.Object(
  {
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
  },
  { $id: "core.auth", additionalProperties: false },
);
export type AuthConfig = Static<typeof AuthConfig>;

export const CaptchaConfig = Type.Object(
  {
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
  },
  { $id: "core.captcha", additionalProperties: false },
);
export type CaptchaConfig = Static<typeof CaptchaConfig>;

export const SetupConfig = Type.Object(
  {
    initialized: Type.Boolean({
      title: "Initialized (cannot be changed)",
    }),
    active: Type.Boolean({
      title: "Global flag to activate/deactivate the CTF",
    }),
    start_time: Type.Optional(
      Type.Number({ title: "CTF Start Time (Epoch milliseconds)" }),
    ),
    end_time: Type.Optional(
      Type.Number({ title: "CTF End Time (Epoch milliseconds)" }),
    ),
  },
  { $id: "core.setup", additionalProperties: false },
);
export type SetupConfig = Static<typeof SetupConfig>;
