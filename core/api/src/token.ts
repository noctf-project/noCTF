import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";

export const AuthTokenType = Type.Enum({
  Session: "session",
  Scoped: "scoped",
});
export type AuthTokenType = Static<typeof AuthTokenType>;

export const AuthToken = Type.Object({
  sid: Type.Integer(),
  sub: Type.Integer(),
  exp: Type.Integer(),
  app: Type.Optional(Type.Integer()),
  scopes: Type.Optional(Type.Array(Type.String())),
});
export type AuthToken = Static<typeof AuthToken>;

export const RegisterTokenData = Type.Object({
  identity: Type.Array(
    Type.Object({
      provider: Type.String(),
      provider_id: Type.String(),
      secret_data: Type.Optional(Type.String()),
    }),
  ),
  flags: Type.Optional(Type.Array(Type.String())),
  roles: Type.Optional(Type.Array(Type.String())),
});
export type RegisterTokenData = Static<typeof RegisterTokenData>;

export const AssociateTokenData = Type.Composite([
  RegisterTokenData,
  Type.Object({
    user_id: Type.Integer(),
  }),
]);
export type AssociateTokenData = Static<typeof AssociateTokenData>;
