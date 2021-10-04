import * as path from 'path';
import { createHash } from 'crypto';
import { SignJWT } from 'jose/jwt/sign';
import { jwtVerify } from 'jose/jwt/verify';
import { importJWK } from 'jose/key/import';
import { JWSInvalid } from 'jose/util/errors';
import { JWK, JWSHeaderParameters, KeyLike } from 'jose/types';
import SecretsService, { QUALIFIER_TOKEN_SIGNATURE } from '../secrets';
import { ERROR_INVALID_TOKEN_SIGURATURE } from '../../util/constants';
import { AuthSigningKey, AuthToken } from '../../util/types';

// Truncate hash values
const TRUNCATE_HASH_LENGTH = 18;
const KEY_PREFERENCES = ['primary', 'secondary'];

export class AuthTokenServiceError extends Error {
}

export default class AuthTokenService {
  private cache: { [name: string]: AuthSigningKey } = {};

  constructor(private secrets: SecretsService, private hostname: string, private expiry: number) {
  }

  public async generate(clientId: string, userId: string, sessionId: string): Promise<string> {
    const key = (await this.getValidKeys())[0];
    return new SignJWT({ cid: clientId, scope: ['all'] })
      .setProtectedHeader({ alg: 'EdDSA', kid: key.publicJWK.kid })
      .setIssuedAt()
      .setSubject(userId)
      .setAudience(this.hostname)
      .setExpirationTime(Math.floor(Date.now() / 1000) + this.expiry)
      .setJti(createHash('sha256')
        .update(sessionId)
        .digest()
        .slice(0, TRUNCATE_HASH_LENGTH)
        .toString('base64url'))
      .sign(key.privateKey);
  }

  public async getPublicJWKs(): Promise<JWK[]> {
    return (await this.getValidKeys()).map(({ publicJWK }) => publicJWK);
  }

  public async parse(token: string): Promise<AuthToken> {
    try {
      const parsed = await jwtVerify(token, this.getPublicKeyForJWT.bind(this), {
        audience: this.hostname,
        algorithms: ['EdDSA'],
      });

      return {
        clientId: parsed.payload.cid as string || '',
        userId: parsed.payload.sub as string || '',
        scope: parsed.payload.scope as string[] || [],
        session: parsed.payload.jti as string || '',
        expires: parsed.payload.exp || 0,
      };
    } catch (e) {
      if (e instanceof JWSInvalid) {
        throw new AuthTokenServiceError(ERROR_INVALID_TOKEN_SIGURATURE);
      }
      throw e;
    }
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
