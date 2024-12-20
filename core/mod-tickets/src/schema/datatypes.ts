import { TypeDate } from "@noctf/api/datatypes";
import { Static, Type } from "@sinclair/typebox";

export enum TicketState {
  Open = "open",
  Closed = "closed",
  Created = "created",
}

export const Ticket = Type.Object({
  id: Type.Number(),
  state: Type.Enum(TicketState),
  team_id: Type.Optional(Type.Number()),
  user_id: Type.Optional(Type.Number()),
  category: Type.String(),
  item: Type.String(),
  provider: Type.String(),
  provider_id: Type.Union([Type.String(), Type.Null()]),
  created_at: TypeDate(),
});
export type Ticket = Static<typeof Ticket>;
