import { Static, Type } from "@sinclair/typebox";

export const AuthTokenType = Type.Enum({
  Auth: "auth",
  Register: "register",
  Associate: "associate",
});
export type AuthTokenType = Static<typeof AuthTokenType>;

export const AuthUserToken = Type.Object({
  sub: Type.Integer(),
});
export type AuthUserToken = Static<typeof AuthUserToken>;

export const AuthRegisterToken = Type.Object({
  identity: Type.Array(
    Type.Object({
      provider: Type.String(),
      provider_id: Type.String(),
    }),
  ),
  flags: Type.Optional(Type.Array(Type.String())),
});
export type AuthRegisterToken = Static<typeof AuthRegisterToken>;

export type AuthToken = AuthUserToken | AuthRegisterToken;
