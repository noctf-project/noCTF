import { Static, Type } from "@sinclair/typebox";

export const AuthTokenType = Type.Enum({
  Session: "session",
  Scoped: "scoped",
  Register: "register",
  Associate: "associate",
});
export type AuthTokenType = Static<typeof AuthTokenType>;

export const AuthSessionToken = Type.Object({
  type: Type.Literal("session"),
  sub: Type.Integer(),
});
export type AuthSessionToken = Static<typeof AuthSessionToken>;

export const AuthScopedToken = Type.Object({
  type: Type.Literal("scoped"),
  sub: Type.Integer(),
  scopes: Type.Array(Type.String())
});
export type AuthScopedToken = Static<typeof AuthScopedToken>;

export const AuthRegisterToken = Type.Object({
  type: Type.Union([Type.Literal("register"), Type.Literal("associate")]),
  identity: Type.Array(
    Type.Object({
      provider: Type.String(),
      provider_id: Type.String(),
    }),
  ),
  flags: Type.Optional(Type.Array(Type.String())),
});
export type AuthRegisterToken = Static<typeof AuthRegisterToken>;

export const AuthAssociateToken = AuthRegisterToken;
export type AuthAssociateToken = Static<typeof AuthRegisterToken>;

export const AuthToken = Type.Union([AuthSessionToken, AuthRegisterToken, AuthScopedToken]);
export type AuthToken = Static<typeof AuthToken>;
