import { RequestGenericInterface } from 'fastify';
import { JWK, KeyLike } from 'jose/types';

export type AuthSigningKey = {
  publicKey: KeyLike;
  publicJWK: JWK;
  privateKey: KeyLike;
  privateJWK: JWK;
};

export type AuthToken = {
  cid: string;
  uid: string;
  iat: number;
  exp: number;
  sid: Uint8Array;
  aud: string;
  scope: string[];
};

export interface Request extends RequestGenericInterface {
  auth?: AuthToken;
}
