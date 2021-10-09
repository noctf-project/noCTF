import { Static, Type } from '@sinclair/typebox';

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
  password: Type.String(),
});
export type AuthVerifyRequestType = Static<typeof AuthVerifyRequest>;
