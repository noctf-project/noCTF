import { Static, Type } from "@sinclair/typebox";

export const AuthOauthInitRequest = Type.Object(
  {
    name: Type.String(),
  },
);
export type AuthOauthInitRequest = Static<typeof AuthOauthInitRequest>;

export const AuthOauthFinishRequest = Type.Object(
  {
    state: Type.String(),
    code: Type.String(),
    redirect_uri: Type.String(),
  },
);
export type AuthOauthFinishRequest = Static<typeof AuthOauthFinishRequest>;

export const AuthEmailInitRequest = Type.Object(
  {
    email: Type.String({ format: "email" }),
  },
);
export type AuthEmailInitRequest = Static<typeof AuthEmailInitRequest>;