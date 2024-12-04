import { Static, Type } from "@sinclair/typebox";

export const TeamConfig = Type.Object(
  {
    allow_registration: Type.Boolean({
      title: "Allow self-service team registration",
    }),
    allow_joining: Type.Boolean({
      title:
        "Allow self-service team joining using join code. Will also allow users" +
        " to leave teams as long as there are no solves (WIP)",
    }),
    restrict_valid_email: Type.Boolean({
      title: "Only allow users with validated emails to register or join.",
    }),
  },
  { $id: "core.team" },
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
  { $id: "core.auth" },
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
  { $id: "core.captcha" },
);
export type CaptchaConfig = Static<typeof CaptchaConfig>;

export const SetupConfig = Type.Object(
  {
    initialized: Type.Boolean({
      title: "Initialized (cannot be changed)",
    }),
  },
  { $id: "core.setup" },
);
export type SetupConfig = Static<typeof SetupConfig>;
