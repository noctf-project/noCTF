import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";

export const AuthorizeQuery = Type.Object({
  client_id: Type.String(),
  redirect_uri: Type.String(),
  scope: Type.String(),
  state: Type.String(),
});
export type AuthorizeQuery = Static<typeof AuthorizeQuery>;

export const AuthorizeResponse = Type.Object({
  url: Type.String(),
});
export type AuthorizeResponse = Static<typeof AuthorizeResponse>;

export const TokenRequest = Type.Object({
  grant_type: Type.String(),
  code: Type.String(),
  redirect_uri: Type.String(),
});
export type TokenRequest = Static<typeof TokenRequest>;

export const TokenResponse = Type.Object({
  access_token: Type.String(),
});
export type TokenResponse = Static<typeof TokenResponse>;
