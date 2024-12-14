import { Static, Type } from "@sinclair/typebox";

export const Ticket = Type.Object({
  id: Type.Number(),
  open: Type.Boolean(),
  team_id: Type.Optional(Type.Number()),
  user_id: Type.Optional(Type.Number()),
  category: Type.String(),
  item: Type.String(),
  provider: Type.String(),
  provider_id: Type.Optional(Type.String()),
  created_at: Type.Date(),
});
export type Ticket = Static<typeof Ticket>;
