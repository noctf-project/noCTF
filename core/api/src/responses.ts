import { Static, Type } from "@sinclair/typebox";
import { AuthMethod, AuthTokenType } from "./datatypes.ts";

export const BaseResponse = Type.Object(
  {
    error: Type.Optional(Type.String()),
    message: Type.Optional(Type.String()),
  },
);
export type BaseResponse = Static<typeof BaseResponse>;

export const AuthListMethodsResponse = Type.Object(
  {
    data: Type.Array(AuthMethod),
  },
);
export type AuthListMethodsResponse = Static<typeof AuthListMethodsResponse>;


export const AuthOauthInitResponse = Type.Object(
  {
    data: Type.String(),
  },
);
export type AuthOauthInitResponse = Static<typeof AuthOauthInitResponse>;

export const AuthFinishResponse = Type.Object(
  {
    data: Type.Object({
      type: AuthTokenType,
      token: Type.String(),
    }),
  },
);
export type AuthFinishResponse = Static<typeof AuthFinishResponse>;