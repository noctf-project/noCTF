import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";

export const OpenTicketRequest = Type.Object({
  description: Type.String(),
  type: Type.String(),
  item: Type.String(),
});
export type OpenTicketRequest = Static<typeof OpenTicketRequest>;

export const OpenTicketResponse = Type.Object({
  data: Type.Object({
    id: Type.Number(),
  }),
});
export type OpenTicketResponse = Static<typeof OpenTicketResponse>;
