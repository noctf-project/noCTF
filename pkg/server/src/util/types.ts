import { RequestGenericInterface } from 'fastify';
import { JWK, KeyLike } from 'jose/types';

export type AuthSigningKey = {
  publicKey: KeyLike;
  publicJWK: JWK;
  privateKey: KeyLike;
  privateJWK: JWK;
  hmacKey: Buffer;
};

export interface AuthTokenBase {
  typ: string;
}

export interface AuthToken extends AuthTokenBase {
  typ: 'auth';
  cid: number;
  uid: number;
  iat: number;
  exp: number;
  sid: Uint8Array;
  aud: string;
  scope: string[];
}

export interface AuthTokenVerify extends AuthTokenBase {
  typ: 'verify';
  tok: Uint8Array;
  exp: number;
  uid: number;
}

export interface Request extends RequestGenericInterface {
  auth?: AuthToken;
}
