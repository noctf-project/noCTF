import { Type } from "@sinclair/typebox";
import { AuthMethod, AuthTokenType } from "./datatypes";

export const BaseResponse = Type.Object(
  {
    error: Type.Optional(Type.String()),
    message: Type.Optional(Type.String()),
  },
  { $id: "BaseResponse" },
);

export const AuthListMethodsResponse = Type.Object(
  {
    data: Type.Array(AuthMethod),
  },
  { $id: "AuthListMethodsResponse" },
);

export const AuthOauthInitResponse = Type.Object(
  {
    data: Type.String(),
  },
  { $id: "AuthOauthInitResponse" },
);

export const AuthFinishResponse = Type.Object(
  {
    data: Type.Object({
      type: AuthTokenType,
      token: Type.String(),
    }),
  },
  { $id: "AuthFinishResponse" },
);

export default [
  BaseResponse,
  AuthListMethodsResponse,
  AuthOauthInitResponse,
  AuthFinishResponse,
];
