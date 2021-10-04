import * as path from 'path';
import cbor from 'cbor';
import NodeCache from 'node-cache';
import { CompactSign } from 'jose/jws/compact/sign';
import { compactVerify } from 'jose/jws/compact/verify';
import { importJWK } from 'jose/key/import';
import { JWSInvalid, JWSSignatureVerificationFailed } from 'jose/util/errors';
import { JWK, JWSHeaderParameters, KeyLike } from 'jose/types';
import { createHash } from 'crypto';
import SecretsService, { QUALIFIER_TOKEN_SIGNATURE } from '../secrets';
import {
  ERROR_EXPIRED, ERROR_INVALID_TOKEN, ERROR_INVALID_TOKEN_SIGURATURE, ERROR_UNKNOWN_AUTH,
} from '../../util/constants';
import { AuthSigningKey, AuthToken } from '../../util/types';
import logger from '../../util/logger';
import { TOKEN_EXPIRY } from '../../config';

// Truncate hash values
const KEY_PREFERENCES = ['primary', 'secondary'];
const TOKEN_CACHE_CHECK = 60;
const CACHE_HIT_VALID = 1;

export class AuthTokenServiceError extends Error {
}

export default class AuthTokenService {
  private keyCache: { [name: string]: AuthSigningKey } = {};

  private tokenCache = new NodeCache({
    stdTTL: TOKEN_EXPIRY,
    checkperiod: TOKEN_CACHE_CHECK,
    maxKeys: 10000,
  });

  constructor(private secrets: SecretsService, private hostname: string, private expiry: number) {
  }

  public async generate(sub: string, scope: string[],
    uid: string, sid: Uint8Array): Promise<string> {
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
    const signed = await new CompactSign(cbor.encode(token))
      .setProtectedHeader({ alg: 'EdDSA', kid: key.publicJWK.kid })
      .sign(key.privateKey);

    const hash = createHash('sha256').update(signed).digest('base64');
    this.tokenCache.set(hash, [CACHE_HIT_VALID, null], token.exp - ctime);
    return signed;
  }

  public async getPublicJWKs(): Promise<JWK[]> {
    return (await this.getValidKeys()).map(({ publicJWK }) => publicJWK);
  }

  public async parse(token: string): Promise<AuthToken> {
    const hash = createHash('sha256').update(token).digest('base64');
    const value: ([number, string?] | undefined) = this.tokenCache.get(hash);

    if (!value) {
      return this.rawParse(token, hash);
    } if (value[0] === CACHE_HIT_VALID) {
      // Token already validated
      const data = Buffer.from(token.split('.')[1], 'base64url');
      return this.validateClaims(data);
    }
    throw new AuthTokenServiceError(value[1] || ERROR_UNKNOWN_AUTH);
  }

  private async rawParse(token: string, hash: string): Promise<AuthToken> {
    const ctime = Math.floor(Date.now() / 1000);

    try {
      const payload = await compactVerify(token, this.getPublicKeyForJWT.bind(this));
      const claims = this.validateClaims(payload.payload);
      this.tokenCache.set(hash, [CACHE_HIT_VALID, null], claims.exp - ctime);

      return claims;
    } catch (e) {
      if (e instanceof JWSInvalid || e instanceof JWSSignatureVerificationFailed) {
        throw new AuthTokenServiceError(ERROR_INVALID_TOKEN_SIGURATURE);
      } else if (e instanceof AuthTokenServiceError) {
        throw e;
      }
      throw e;
    }
  }

  private validateClaims(data: ArrayBuffer): AuthToken {
    const ctime = Math.floor(Date.now() / 1000);
    const token = cbor.decode(data);

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
      this.keyCache[name]?.version,
    );

    if (!secret && !this.keyCache[name]) {
      throw new AuthTokenServiceError(`no ${name} key found in secrets`);
    }
    if (!secret && this.keyCache[name]) return this.keyCache[name];

    const privateJWK: JWK = JSON.parse(secret ? secret[1] : '{}');
    const publicJWK: JWK = { ...privateJWK, d: undefined };

    this.keyCache[name] = {
      version: secret ? secret[0] : 0,
      publicKey: await importJWK(publicJWK, 'EdDSA'),
      privateKey: await importJWK(privateJWK, 'EdDSA'),
      publicJWK,
      privateJWK,
    };

    return this.keyCache[name];
  }

  private getValidKeys(): Promise<AuthSigningKey[]> {
    return Promise.all(KEY_PREFERENCES.map((name) => this.getKey(name)));
  }
}
