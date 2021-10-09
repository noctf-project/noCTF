import { Static, Type } from '@sinclair/typebox';
import { JWK } from './datatypes';

export const DefaultResponse = Type.Object({
  error: Type.Optional(Type.String()),
});
export type DefaultResponseType = Static<typeof DefaultResponse>;

export const AuthLoginResponse = Type.Object({
  access_token: Type.String(),
  refresh_token: Type.String(),
  expires: Type.Number(),
});
export type AuthLoginResponseType = (
  DefaultResponseType | Static<typeof AuthLoginResponse>
);

export const AuthRegisterResponse = DefaultResponse;
export type AuthRegisterResponseType = (
  DefaultResponseType | Static<typeof AuthRegisterResponse>
);

export const AuthRegisterCheckResponse = Type.Object({
  exists: Type.Boolean(),
});
export type AuthRegisterCheckResponseType = (
  DefaultResponseType | Static<typeof AuthRegisterCheckResponse>
);

export const AuthVerifyResponse = AuthLoginResponse;
export type AuthVerifyResponseType = (
  DefaultResponseType | Static<typeof AuthVerifyResponse>
);

export const AuthJWKSResponse = Type.Object({
  keys: Type.Array(JWK),
});
export type AuthJWKSResponseType = (
  DefaultResponseType | Static<typeof AuthJWKSResponse>
);

export const AuthPermissionsResponse = Type.Object({
  permissions: Type.Array(Type.String()),
});
export type AuthPermissionsResponseType = (
  DefaultResponseType | Static<typeof AuthPermissionsResponse>
);
