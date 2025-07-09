import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import { EmailAddress, ScoringStrategy } from "./datatypes.ts";
import { CaptchaHTTPMethod } from "./types.ts";

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
    allowed_email_domains: Type.Optional(
      Type.Array(
        Type.String({
          format: "hostname",
        }),
        { title: "Allowed email domains" },
      ),
    ),
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
      Type.Object(
        {
          method: Type.Enum(CaptchaHTTPMethod, { title: "HTTP Method" }),
          path: Type.String({ title: "Route path" }),
        },
        { additionalProperties: false },
      ),
      {
        title: "Routes",
        description: "Routes as defined in the OpenAPI Schema",
      },
    ),
  },
  { $id: "core.captcha", additionalProperties: false },
);
export type CaptchaConfig = Static<typeof CaptchaConfig>;

// do not put admin private information in this config
// the data below is being exposed to players
export const SetupConfig = Type.Object(
  {
    initialized: Type.Boolean({
      title: "Initialized (cannot be changed)",
    }),
    active: Type.Boolean({
      title: "Global flag to activate/deactivate the CTF",
    }),
    root_url: Type.String({
      format: "uri",
      title: "Public URL of the Scoreboard",
    }),
    name: Type.String({ title: "Name of the CTF" }),
    start_time_s: Type.Optional(
      Type.Number({ title: "CTF Start Time (Epoch seconds)" }),
    ),
    end_time_s: Type.Optional(
      Type.Number({ title: "CTF End Time (Epoch seconds)" }),
    ),
    default_division_id: Type.Optional(
      Type.Number({
        title: "Default Division for new users",
      }),
    ),
  },
  { $id: "core.setup", additionalProperties: false },
);
export type SetupConfig = Static<typeof SetupConfig>;

export const FileConfig = Type.Object(
  {
    upload: Type.String({
      title: "Selected Provider Instance",
      description: "New uploads will use this provider instance",
    }),
    instances: Type.Record(Type.String(), Type.Any(), {
      title: "Provider Instances",
    }),
  },
  { $id: "core.file", additionalProperties: false },
);
export type FileConfig = Static<typeof FileConfig>;

export const ScoreConfig = Type.Object(
  {
    strategies: Type.Record(
      Type.String(),
      Type.Omit(ScoringStrategy, ["source"]),
      { title: "Scoring Strategies" },
    ),
  },
  { $id: "core.score", additionalProperties: false },
);
export type ScoreConfig = Static<typeof ScoreConfig>;

export const EmailConfig = Type.Object(
  {
    provider: Type.String({ title: "Provider Name" }),
    from: EmailAddress,
    config: Type.Optional(Type.Any({ title: "Provider Specific Config" })),
  },
  { $id: "core.email", additionalProperties: false },
);
export type EmailConfig = Static<typeof EmailConfig>;

export const NotificationConfig = Type.Object(
  {
    blood: Type.Optional(
      Type.Array(
        Type.Object({
          url: Type.String({ format: "uri", title: "Webhook URL" }),
          type: Type.Union([Type.Literal("discord"), Type.Literal("webhook")], {
            title: "Notification Type",
          }),
          template: Type.String({
            title: "Message template",
            description:
              "Handlebars template for the message. Does not apply to the webhook notification type",
          }),
          division_ids: Type.Optional(
            Type.Array(Type.Number(), { title: "Division Filter" }),
          ),
          all: Type.Boolean({
            title: "All Solves?",
            description:
              "Set to true to notify for all solves. Otherwise first blood only.",
          }),
          enabled: Type.Boolean({ title: "Enabled" }),
        }),
        { title: "First Blood Settings" },
      ),
    ),
  },
  { $id: "core.notification", additionalProperties: false },
);
export type NotificationConfig = Static<typeof NotificationConfig>;
