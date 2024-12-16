import { Static, Type } from "@sinclair/typebox";

export const SupportSpec = Type.Object({
  name: Type.String({
    title: "Name of category",
  }),
  requester: Type.Enum(
    {
      User: "user",
      Team: "team",
    },
    { title: "Requester Type" },
  ),
  can_open: Type.Boolean({ title: "Can users (non-admins) open tickets?" }),
});
export type SupportSpec = Static<typeof SupportSpec>;

export enum TicketProvider {
  Discord = "discord",
}

export const TicketConfig = Type.Object(
  {
    provider: Type.Enum(TicketProvider, {
      title: "Currently, only the discord provider is supported",
    }),
    enabled: Type.Boolean({
      title: "Enable/Disable ticket creation.",
    }),
    team_open_limit: Type.Number({
      title:
        "Number of tickets that can be open at once for a team. " +
        "Does not include admin initiated tickets. 0 for unlimited.",
    }),
    user_open_limit: Type.Number({
      title:
        "Number of tickets that can be open at once for a user. " +
        "Does not include admin initiated tickets. 0 for unlimited.",
    }),
    support_specs: Type.Record(Type.String(), SupportSpec, {
      title: "Support ticket categories.",
    }),
    discord: Type.Optional(
      Type.Object(
        {
          bot_token: Type.String({ title: "Bot Token" }),
          public_key: Type.String({
            title: "Public Key for interactions webhook",
          }),
          tickets_channel_id: Type.String({
            title: "Discord Channel ID where tickets are created.",
            pattern: "^\\d+",
          }),
          notifications_channel_id: Type.Optional(
            Type.String({
              title: "Discord Channel ID to store private ticket notes.",
              pattern: "^\\d+",
            }),
          ),
        },
        {
          title: "Discord Provider Options",
        },
      ),
    ),
  },
  { $id: "core.tickets" },
);
export type TicketConfig = Static<typeof TicketConfig>;

export const DEFAULT_CONFIG: TicketConfig = {
  provider: TicketProvider.Discord,
  enabled: false,
  team_open_limit: 0,
  user_open_limit: 0,
  support_specs: {
    "general-user": {
      name: "General Support (User)",
      requester: "user",
      can_open: true,
    },
    "general-team": {
      name: "General Support (Team)",
      requester: "team",
      can_open: true,
    },
  },
};
