import { Type } from "@sinclair/typebox";

export const AuthOauthInitRequest = Type.Object(
  {
    name: Type.String(),
  },
  { $id: "AuthOauthInitRequest" },
);

export const AuthOauthFinishRequest = Type.Object(
  {
    state: Type.String(),
    code: Type.String(),
    redirect_uri: Type.String(),
  },
  { $id: "AuthOauthFinishRequest" },
);

export const AuthEmailInitRequest = Type.Object(
  {
    email: Type.String({ format: "email" }),
  },
  { $id: "AuthEmailInitRequest" },
);

export default [
  AuthOauthInitRequest,
  AuthOauthFinishRequest,
  AuthEmailInitRequest,
];
