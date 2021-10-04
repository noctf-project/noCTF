import { Static, Type } from '@sinclair/typebox';
import { JWK } from './datatypes';

export const DefaultResponse = Type.Object({
  error: Type.Optional(Type.String()),
});
export type DefaultResponseType = Static<typeof DefaultResponse>;

export const AuthLoginResponse = Type.Object({
  ...DefaultResponse.properties,
  token: Type.String(),
});
export type AuthLoginResponseType = Static<typeof AuthLoginResponse>;

export const AuthRegisterResponse = DefaultResponse;
export type AuthRegisterResponseType = Static<typeof AuthRegisterResponse>;

export const AuthVerifyResponse = AuthLoginResponse;
export type AuthVerifyResponseType = Static<typeof AuthVerifyResponse>;

export const AuthJWKSResponse = Type.Object({
  ...DefaultResponse.properties,
  keys: Type.Array(JWK),
});
export type AuthJWKSResponseType = Static<typeof AuthJWKSResponse>;

export const AuthPermissionsResponse = Type.Object({
  ...DefaultResponse.properties,
  permissions: Type.Array(Type.String()),
});
export type AuthPermissionsResponseType = Static<typeof AuthPermissionsResponse>;
