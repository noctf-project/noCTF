import { Static, Type } from '@sinclair/typebox';
import { AuthAuthorizeGrantTypeEnum } from './datatypes';

export const AuthLoginRequest = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String(),
});
export type AuthLoginRequestType = Static<typeof AuthLoginRequest>;

export const AuthRegisterRequest = Type.Object({
  name: Type.String(),
  email: Type.String({ format: 'email' }),
});
export type AuthRegisterRequestType = Static<typeof AuthRegisterRequest>;

export const AuthRegisterCheckRequest = Type.Object({
  name: Type.Optional(Type.String()),
  email: Type.Optional(Type.String({ format: 'email' })),
});
export type AuthRegisterCheckRequestType = Static<typeof AuthRegisterCheckRequest>;

export const AuthVerifyRequest = Type.Object({
  token: Type.String(),
  password: Type.String({ minLength: 8 }),
});
export type AuthVerifyRequestType = Static<typeof AuthVerifyRequest>;

export const AuthResetRequest = Type.Object({
  email: Type.String({ format: 'email' }),
});
export type AuthResetRequestType = Static<typeof AuthResetRequest>;

export const AuthTokenRequest = Type.Object({
  code: Type.Optional(Type.String({ minLength: 32 })),
  refresh_token: Type.Optional(Type.String({ minLength: 32 })),
  grant_type: Type.Enum(AuthAuthorizeGrantTypeEnum),
  client_id: Type.String(),
  client_secret: Type.Optional(Type.String()),
});
export type AuthTokenRequestType = Static<typeof AuthTokenRequest>;
