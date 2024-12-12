import { Static, Type } from "@sinclair/typebox";

export const OpenTicketRequest = Type.Composite([
  Type.Union([
    Type.Object({
      challenge_id: Type.Number(),
    }),
    Type.Object({
      support_id: Type.String(),
    }),
  ]),
  Type.Object({
    title: Type.String(),
  }),
]);
export type OpenTicketRequest = Static<typeof OpenTicketRequest>;

export const OpenTicketResponse = Type.Object({
  data: Type.Object({
    id: Type.Number(),
  }),
});
export type OpenTicketResponse = Static<typeof OpenTicketResponse>;
