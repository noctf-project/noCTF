import { JWK, KeyLike } from 'jose/types';

export type Key = {
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
