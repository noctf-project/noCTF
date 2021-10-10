import { Static, Type } from '@sinclair/typebox';
import { JWK } from './datatypes';

export const ErrorResponse = Type.Object({
  error: Type.Optional(Type.String()),
});
export type ErrorResponseType = Static<typeof ErrorResponse>;

export const AuthLoginResponse = Type.Object({
  access_token: Type.String(),
  refresh_token: Type.String(),
  expires: Type.Number(),
});
export type AuthLoginResponseType = Static<typeof AuthLoginResponse>;

export const AuthRegisterResponse = Type.Object({
  token: Type.Optional(Type.String()),
});
export type AuthRegisterResponseType = Static<typeof AuthRegisterResponse>;

export const AuthRegisterCheckResponse = Type.Object({
  exists: Type.Boolean(),
});
export type AuthRegisterCheckResponseType = Static<typeof AuthRegisterCheckResponse>;

export const AuthVerifyResponse = AuthLoginResponse;
export type AuthVerifyResponseType = Static<typeof AuthVerifyResponse>;

export const AuthJWKSResponse = Type.Object({
  keys: Type.Array(JWK),
});
export type AuthJWKSResponseType = Static<typeof AuthJWKSResponse>;

export const AuthPermissionsResponse = Type.Object({
  permissions: Type.Array(Type.String()),
});
export type AuthPermissionsResponseType = Static<typeof AuthPermissionsResponse>;

export const AuthRefreshResponse = Type.Object({
  access_token: Type.String(),
  expires: Type.Number(),
});
export type AuthRefreshResponseType = Static<typeof AuthRefreshResponse>;
