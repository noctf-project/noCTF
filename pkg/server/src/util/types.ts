import { RequestGenericInterface } from 'fastify';
import { JWK, KeyLike } from 'jose/types';

export type AuthSigningKey = {
  version: number;
  publicKey: KeyLike;
  publicJWK: JWK;
  privateKey: KeyLike;
  privateJWK: JWK;
};

export type AuthToken = {
  clientId: string;
  userId: string;
  expires: number;
  scope: string[];
  session: string;
};

export interface Request extends RequestGenericInterface {
  auth?: AuthToken;
}
