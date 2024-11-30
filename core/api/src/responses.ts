import { Static, Type } from "@sinclair/typebox";
import { AuthMethod } from "./datatypes.ts";
import { AuthRegisterToken, AuthTokenType } from "./token.ts";

export const BaseResponse = Type.Object({
  error: Type.Optional(Type.String()),
  message: Type.Optional(Type.String()),
});
export type BaseResponse = Static<typeof BaseResponse>;

export const CaptchaConfigResponse = Type.Object({
  data: Type.Object({
    provider: Type.String(),
    public_key: Type.String(),
  }),
});
export type CaptchaConfigResponse = Static<typeof CaptchaConfigResponse>;

export const AuthListMethodsResponse = Type.Object({
  data: Type.Array(AuthMethod),
});
export type AuthListMethodsResponse = Static<typeof AuthListMethodsResponse>;

export const AuthOauthInitResponse = Type.Object({
  data: Type.String(),
});
export type AuthOauthInitResponse = Static<typeof AuthOauthInitResponse>;

export const AuthFinishResponse = Type.Object({
  data: Type.Object({
    type: AuthTokenType,
    token: Type.String(),
  }),
});
export type AuthFinishResponse = Static<typeof AuthFinishResponse>;

export const AuthRegisterTokenResponse = Type.Object({
  data: Type.Omit(AuthRegisterToken, ["type"]),
});
export type AuthRegisterTokenResponse = Static<
  typeof AuthRegisterTokenResponse
>;
