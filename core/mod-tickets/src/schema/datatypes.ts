import { TypeDate } from "@noctf/api/datatypes";
import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";

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
  assignee_id: Type.Union([Type.Number(), Type.Null()]),
  category: Type.String(),
  item: Type.String(),
  provider: Type.String(),
  provider_id: Type.Union([Type.String(), Type.Null()]),
  provider_metadata: Type.Union([
    Type.Record(Type.String(), Type.String()),
    Type.Null(),
  ]),
  created_at: TypeDate(),
});
export type Ticket = Static<typeof Ticket>;

export const UpdateTicket = Type.Omit(Type.Partial(Ticket), [
  "id",
  "created_at",
]);
export type UpdateTicket = Static<typeof UpdateTicket>;

export const TicketStateMessage = Type.Object({
  lease: Type.String(),
  desired_state: Type.Enum(TicketState),
  id: Type.Number(),
});
export type TicketStateMessage = Static<typeof TicketStateMessage>;

export const TicketApplyMessage = Type.Object({
  lease: Type.String(),
  properties: Type.Partial(Ticket),
  id: Type.Number(),
});
export type TicketApplyMessage = Static<typeof TicketApplyMessage>;
