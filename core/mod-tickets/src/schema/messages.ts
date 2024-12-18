import { Static, Type } from "@sinclair/typebox";
import { Ticket, TicketState } from "./datatypes.ts";

export const TicketStateUpdateMessage = Type.Object({
  actor: Type.String(),
  lease: Type.String(),
  desired_state: Type.Enum(TicketState),
  id: Type.Number(),
});
export type TicketStateUpdateMessage = Static<typeof TicketStateUpdateMessage>;
