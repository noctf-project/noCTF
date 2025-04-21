import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";

export const AuthTokenType = Type.Enum({
  Session: "session",
  Scoped: "scoped",
});
export type AuthTokenType = Static<typeof AuthTokenType>;

export const AuthSessionToken = Type.Object({
  aud: Type.Literal("session"),
  jti: Type.Optional(Type.String()),
  sub: Type.Integer(),
});
export type AuthSessionToken = Static<typeof AuthSessionToken>;

export const AuthScopedToken = Type.Object({
  aud: Type.Literal("scoped"),
  jti: Type.Optional(Type.String()),
  sub: Type.Integer(),
  scopes: Type.Array(Type.String()),
});
export type AuthScopedToken = Static<typeof AuthScopedToken>;

export const AuthToken = Type.Union([AuthSessionToken, AuthScopedToken]);
export type AuthToken = Static<typeof AuthToken>;

export const RegisterTokenData = Type.Object({
  identity: Type.Array(
    Type.Object({
      provider: Type.String(),
      provider_id: Type.String(),
      secret_data: Type.Optional(Type.String())
    }),
  ),
  flags: Type.Optional(Type.Array(Type.String())),
  roles: Type.Optional(Type.Array(Type.String())),
});
export type RegisterTokenData = Static<typeof RegisterTokenData>;

export const AssociateTokenData = Type.Object({
  identity: Type.Array(
    Type.Object({
      provider: Type.String(),
      provider_id: Type.String(),
      secret_data: Type.Optional(Type.String())
    }),
  ),
  user_id: Type.Number(),
});
export type AssociateTokenData = Static<typeof AssociateTokenData>;

