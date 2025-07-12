import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import { Ticket } from "./datatypes.ts";

export const OpenTicketRequest = Type.Pick(Ticket, ["category", "item"], {
  additionalProperties: false,
});
export type OpenTicketRequest = Static<typeof OpenTicketRequest>;

export const OpenTicketResponse = Type.Object({
  data: Type.Object({
    id: Type.Number(),
  }),
});
export type OpenTicketResponse = Static<typeof OpenTicketResponse>;

export const UpdateTicketRequest = Type.Pick(
  Type.Partial(Ticket),
  ["state", "assignee_id"],
  { additionalProperties: false },
);
export type UpdateTicketRequest = Static<typeof UpdateTicketRequest>;

export const UpdateTicketResponse = Type.Object({
  data: Type.Partial(Type.Pick(Ticket, ["state", "updated_at"])),
});
export type UpdateTicketResponse = Static<typeof UpdateTicketResponse>;
