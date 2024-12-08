import { Static, Type } from "@sinclair/typebox";
import { AuditLogEntry, AuthMethod } from "./datatypes.ts";
import { AuthRegisterToken, AuthTokenType } from "./token.ts";

export const BaseResponse = Type.Object({
  error: Type.Optional(Type.String()),
  message: Type.Optional(Type.String()),
});
export type BaseResponse = Static<typeof BaseResponse>;

export const GetCaptchaConfigResponse = Type.Object({
  data: Type.Optional(
    Type.Object({
      provider: Type.String(),
      public_key: Type.String(),
      routes: Type.Array(Type.String()),
    }),
  ),
});
export type GetCaptchaConfigResponse = Static<typeof GetCaptchaConfigResponse>;

export const ListAuthMethodsResponse = Type.Object({
  data: Type.Array(AuthMethod),
});
export type ListAuthMethodsResponse = Static<typeof ListAuthMethodsResponse>;

export const InitAuthOauthResponse = Type.Object({
  data: Type.String(),
});
export type InitAuthOauthResponse = Static<typeof InitAuthOauthResponse>;

export const FinishAuthResponse = Type.Object({
  data: Type.Object({
    type: AuthTokenType,
    token: Type.String(),
  }),
});
export type FinishAuthResponse = Static<typeof FinishAuthResponse>;

export const RegisterAuthTokenResponse = Type.Object({
  data: Type.Omit(AuthRegisterToken, ["type"]),
});
export type RegisterAuthTokenResponse = Static<
  typeof RegisterAuthTokenResponse
>;

export const GetAdminConfigValueResponse = Type.Object({
  data: Type.Object({
    value: Type.Any(),
    version: Type.Number(),
  }),
});
export type GetAdminConfigValueResponse = Static<
  typeof GetAdminConfigValueResponse
>;

export const QueryAuditLogResponse = Type.Object({
  data: Type.Array(AuditLogEntry),
});
export type QueryAuditLogResponse = Static<
  typeof QueryAuditLogResponse
>;
