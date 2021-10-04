import { Static, Type } from '@sinclair/typebox';

export const AuthLoginRequest = Type.Object({
  username: Type.String(),
  password: Type.String(),
});
export type AuthLoginRequestType = Static<typeof AuthLoginRequest>;

export const AuthRegisterRequest = Type.Object({
  username: Type.String(),
  email: Type.String(),
});
export type AuthRegisterRequestType = Static<typeof AuthRegisterRequest>;

export const AuthVerifyRequest = Type.Object({
  token: Type.String(),
  password: Type.String(),
});
export type AuthVerifyRequestType = Static<typeof AuthVerifyRequest>;
