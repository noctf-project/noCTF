import { Static, Type } from "@sinclair/typebox";

export const AuthTokenType = Type.Enum({
  Auth: "auth",
  Register: "register",
  Associate: "associate",
});
export type AuthTokenType = Static<typeof AuthTokenType>;

export const AuthUserToken = Type.Object({
  type: Type.Literal("auth"),
  sub: Type.Integer(),
});
export type AuthUserToken = Static<typeof AuthUserToken>;

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

export const AuthToken = Type.Union([AuthUserToken, AuthRegisterToken]);
export type AuthToken = Static<typeof AuthToken>;
