import { Type } from "@sinclair/typebox";
import { AuthMethod } from "./datatypes";

export const ErrorResponse = Type.Object(
  {
    error: Type.String(),
  },
  { $id: "ErrorResponse" },
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

export default [ErrorResponse, AuthListMethodsResponse, AuthOauthInitResponse];
