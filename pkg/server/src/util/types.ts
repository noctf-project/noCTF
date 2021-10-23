import { RequestGenericInterface } from 'fastify';
import { JWK, KeyLike } from 'jose/types';

export type AuthSigningKey = {
  publicKey: KeyLike;
  publicJWK: JWK;
  privateKey: KeyLike;
  privateJWK: JWK;
  symmetricKey: Buffer;
};

export interface AuthTokenBase {
  typ: string;
  iat: number;
  exp: number;
  aud: string;
  uid: number;
}

export interface AuthToken extends AuthTokenBase {
  typ: 'auth';
  aid: number;
  sid: Uint8Array;
  aud: string;
  prm: string[][];
}

export interface AuthTokenVerify extends AuthTokenBase {
  typ: 'verify';
  tok: Uint8Array;
}

export interface AuthTokenCode extends AuthTokenBase {
  typ: 'code';
  tok: Uint8Array;
  aid: number;
  scp: string[];
}

export interface Request extends RequestGenericInterface {
  auth?: AuthToken;
}

export type KeyValue<T> = { [key: string]: T };
