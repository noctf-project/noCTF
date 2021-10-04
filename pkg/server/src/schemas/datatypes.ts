import { Static, Type } from '@sinclair/typebox';

export const JWK = Type.Object({
  kid: Type.Optional(Type.String()),
  kty: Type.Optional(Type.String()),
  crv: Type.Optional(Type.String()),
  alg: Type.Optional(Type.String()),
  x: Type.Optional(Type.String()),
  d: Type.Optional(Type.String()),
});
export type JWKType = Static<typeof JWK>;

export const PublicUser = Type.Object({
  id: Type.String(),
  username: Type.String(),
});
