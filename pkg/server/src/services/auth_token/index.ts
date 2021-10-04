import * as path from 'path';
import cbor from 'cbor';
import { CompactSign } from 'jose/jws/compact/sign';
import { compactVerify } from 'jose/jws/compact/verify';
import { importJWK } from 'jose/key/import';
import { JWSInvalid, JWTExpired } from 'jose/util/errors';
import { JWK, JWSHeaderParameters, KeyLike } from 'jose/types';
import SecretsService, { QUALIFIER_TOKEN_SIGNATURE } from '../secrets';
import {
  ERROR_EXPIRED, ERROR_INVALID_TOKEN, ERROR_INVALID_TOKEN_SIGURATURE
} from '../../util/constants';
import { AuthSigningKey, AuthToken } from '../../util/types';
import logger from '../../util/logger';

// Truncate hash values
const KEY_PREFERENCES = ['primary', 'secondary'];

export class AuthTokenServiceError extends Error {
}

export default class AuthTokenService {
  private cache: { [name: string]: AuthSigningKey } = {};

  constructor(private secrets: SecretsService, private hostname: string, private expiry: number) {
  }

  public async generate(sub: string, scope: string[], uid: string, sid: Uint8Array): Promise<string> {
    const key = (await this.getValidKeys())[0];
    const ctime = Math.floor(Date.now() / 1000);

    const token = {
      aud: this.hostname,
      sub,
      uid,
      sid,
      iat: ctime,
      exp: ctime + this.expiry,
      scope,
    };
    return await new CompactSign(cbor.encode(token))
      .setProtectedHeader({ alg: 'EdDSA', kid: key.publicJWK.kid })
      .sign(key.privateKey);
  }

  public async getPublicJWKs(): Promise<JWK[]> {
    return (await this.getValidKeys()).map(({ publicJWK }) => publicJWK);
  }

  public async parse(token: string): Promise<AuthToken> {
    try {
      const payload = await compactVerify(token, this.getPublicKeyForJWT.bind(this));
      try {
        const data = cbor.decode(payload.payload);
        return this.validateClaims(data as unknown as AuthToken);
      } catch (e) {
        if (e instanceof AuthTokenServiceError) {
          throw e;
        }

        logger.error('cbor decoding error', e);
        throw new AuthTokenServiceError('token decode error');
      }

      return {} as unknown as AuthToken;
    } catch (e) {
      if (e instanceof JWSInvalid) {
        throw new AuthTokenServiceError(ERROR_INVALID_TOKEN_SIGURATURE);
      } else if (e instanceof JWTExpired) {
        throw new AuthTokenServiceError(ERROR_EXPIRED);
      }
      throw e;
    }
  }

  private validateClaims(token: AuthToken): AuthToken {
    const ctime = Math.floor(Date.now() / 1000);

    if (token.aud !== this.hostname) {
      throw new AuthTokenServiceError(ERROR_INVALID_TOKEN);
    }
    
    if (ctime < token.iat) {
      logger.error('token is issued before current time', token);
      throw new AuthTokenServiceError(ERROR_EXPIRED);
    }

    if (ctime > token.exp) {
      throw new AuthTokenServiceError(ERROR_EXPIRED);
    }
    
    if (!token.sid || !token.sub || !token.uid) {
      logger.error('invalid token format', token);
      throw new AuthTokenServiceError(ERROR_INVALID_TOKEN);
    }
    
    // add scope if its missing
    if (!token.scope) {
      token.scope = [];
    }

    return token;
  }

  private async getPublicKeyForJWT(header: JWSHeaderParameters): Promise<KeyLike> {
    const match = (await this.getValidKeys())
      .find(({ publicJWK: { kid } }) => kid === header.kid);

    if (!match) throw new AuthTokenServiceError('signing key does not exist');

    return match.publicKey;
  }

  private async getKey(name: string): Promise<AuthSigningKey> {
    const secret = await this.secrets.getSecret(
      path.join(QUALIFIER_TOKEN_SIGNATURE, name),
      this.cache[name]?.version,
    );

    if (!secret && !this.cache[name]) { throw new AuthTokenServiceError(`no ${name} key found in secrets`); }
    if (!secret && this.cache[name]) return this.cache[name];

    const privateJWK: JWK = JSON.parse(secret ? secret[1] : '{}');
    const publicJWK: JWK = { ...privateJWK, d: undefined };

    this.cache[name] = {
      version: secret ? secret[0] : 0,
      publicKey: await importJWK(publicJWK, 'EdDSA'),
      privateKey: await importJWK(privateJWK, 'EdDSA'),
      publicJWK,
      privateJWK,
    };

    return this.cache[name];
  }

  private getValidKeys(): Promise<AuthSigningKey[]> {
    return Promise.all(KEY_PREFERENCES.map((name) => this.getKey(name)));
  }
}
