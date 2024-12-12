import { Static, Type } from "@sinclair/typebox";

export const Ticket = Type.Object({
  id: Type.Number(),
  open: Type.Boolean(),
  description: Type.String(),
  team_id: Type.Optional(Type.Number()),
  user_id: Type.Optional(Type.Number()),
  challenge_id: Type.Optional(Type.Number()),
  support_id: Type.Optional(Type.String()),
  dedupe_id: Type.Optional(Type.String()),
  requesting_user_id: Type.Number(),
  provider: Type.String(),
  provider_state: Type.String(),
  provider_data: Type.Any(),
  created_at: Type.Date(),
});
export type Ticket = Static<typeof Ticket>;
