import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";

export const AuthTokenType = Type.Enum({
  Session: "session",
  Scoped: "scoped",
});
export type AuthTokenType = Static<typeof AuthTokenType>;

export const AuthToken = Type.Object({
  sid: Type.String(),
  sub: Type.String(),
  exp: Type.Integer(),
  app: Type.Optional(Type.String()),
  scopes: Type.Optional(Type.Array(Type.String())),
});
export type AuthToken = Static<typeof AuthToken>;
