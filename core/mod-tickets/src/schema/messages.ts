import { Static, Type } from "@sinclair/typebox";
import { Ticket } from "./datatypes.ts";

export const TicketStateMessage = Type.Object({
  actor: Type.String(),
  ticket: Ticket,
});
export type TicketStateMessage = Static<typeof TicketStateMessage>;
