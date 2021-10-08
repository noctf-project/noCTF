import cbor from 'cbor';
import * as path from 'path';
import NodeCache from 'node-cache';
import { CompactSign } from 'jose/jws/compact/sign';
import { compactVerify } from 'jose/jws/compact/verify';
import { importJWK } from 'jose/key/import';
import { JWSInvalid, JWSSignatureVerificationFailed } from 'jose/util/errors';
import { JWK, JWSHeaderParameters, KeyLike } from 'jose/types';
import { createHash } from 'crypto';
import { AuthSigningKey, AuthToken } from '../../util/types';
import logger from '../../util/logger';
import { TOKEN_EXPIRY } from '../../config';
import CacheService from '../cache';
import SecretRetriever from '../../util/secret_retriever';

const TOKEN_CACHE_TTL = 15;
const TOKEN_CACHE_CHECK = 120;
const TOKEN_MAX_KEYS = 10000;
const MAX_DRIFT = 60;
const CACHE_HIT_VALID = 1;
const CACHE_HIT_REVOKED = 2;
const REVOKED_KEY = 'auth_revoked';

export class AuthTokenServiceError extends Error {
}

const QUALIFIER = 'token-signature';
export default class AuthTokenService {
  private log = logger.child({ filename: path.basename(__filename) });
  private keys = new SecretRetriever<AuthSigningKey>(QUALIFIER, {
    cast: AuthTokenService.parseSecret,
  });

  private tokenCache = new NodeCache({
    stdTTL: TOKEN_EXPIRY,
    checkperiod: TOKEN_CACHE_CHECK,
    maxKeys: TOKEN_MAX_KEYS,
  });

  constructor(private externalCache: CacheService,
    private hostname: string, private expiry: number) {
  }

  public async generate(cid: string, scope: string[],
    uid: string, sid: Uint8Array): Promise<string> {
    const keys = await this.keys.getAll();
    // Get the first suitable key (key with an id greater than the current time)
    const version = Object.keys(keys)
      .map(parseInt)
      .filter((v) => !!v)
      .sort((a, b) => b - a)
      .find((id) => id <= Math.floor(Date.now()/1000));
    if (!version) {
      throw new AuthTokenServiceError('cannot find suitable signing key');
    }
    const key = keys[version];

    const ctime = Math.floor(Date.now() / 1000);

    const token: AuthToken = {
      aud: this.hostname,
      cid,
      uid,
      sid,
      iat: ctime,
      exp: ctime + this.expiry,
      scope,
    };
    const signed = await new CompactSign(cbor.encode(token))
      .setProtectedHeader({ alg: 'EdDSA', kid: key.publicJWK.kid })
      .sign(key.privateKey);

    const hash = createHash('sha256').update(signed).digest().toString('base64url');
    this.tokenCache.set(hash, CACHE_HIT_VALID, TOKEN_CACHE_TTL);
    return signed;
  }

  private async checkRevocation(sid: ArrayBuffer): Promise<boolean> {
    return !!(await this.externalCache.get(`${REVOKED_KEY}:${Buffer.from(sid).toString('base64url')}`));
  }

  public async revoke(sid: ArrayBuffer) {
    await this.externalCache.setex(
      `${REVOKED_KEY}:${Buffer.from(sid).toString('base64url')}`,
      this.expiry + MAX_DRIFT,
      '1',
    );
  }

  public async getPublicJWKs(): Promise<JWK[]> {
    const keys = this.keys.getAll();
    return Object.keys(keys).map((key) => keys[key].publicJWK);
  }

  public async parse(token: string): Promise<AuthToken> {
    const hash = createHash('sha256').update(token).digest().toString('base64url');
    const value: (number | undefined) = this.tokenCache.get(hash);

    if (!value) {
      return this.rawParse(token, hash);
    } if (value === CACHE_HIT_VALID) {
      // Token already validated
      const data = Buffer.from(token.split('.')[1], 'base64url');
      return this.validateClaims(data);
    } if (value === CACHE_HIT_REVOKED) {
      throw new AuthTokenServiceError('revoked');
    }
    throw new AuthTokenServiceError('unknown token error');
  }

  private async rawParse(token: string, hash: string): Promise<AuthToken> {
    const ctime = Math.floor(Date.now() / 1000);

    try {
      const payload = await compactVerify(token, this.getPublicKeyForJWT.bind(this));
      const claims = this.validateClaims(payload.payload);
      if (await this.checkRevocation(claims.sid)) {
        this.tokenCache.set(hash, CACHE_HIT_REVOKED, claims.exp - ctime);
        throw new AuthTokenServiceError('revoked');
      }
      this.tokenCache.set(
        hash,
        CACHE_HIT_VALID,
        Math.min(claims.exp - ctime, TOKEN_CACHE_TTL),
      );
      return claims;
    } catch (e) {
      if (e instanceof JWSInvalid || e instanceof JWSSignatureVerificationFailed) {
        throw new AuthTokenServiceError('invalid signature');
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
      throw new AuthTokenServiceError('invalid audience');
    }

    if (ctime < token.iat) {
      this.log.error({ token }, 'token is issued before current time');
      throw new AuthTokenServiceError('expired');
    }

    if (ctime > token.exp) {
      throw new AuthTokenServiceError('expired');
    }

    if (!token.sid || !token.cid || !token.uid) {
      this.log.error({ token }, 'invalid token format');
      throw new AuthTokenServiceError('invalid token format');
    }

    // add scope if its missing
    if (!token.scope) {
      token.scope = [];
    }

    return token;
  }

  private async getPublicKeyForJWT(header: JWSHeaderParameters): Promise<KeyLike> {
    const keys = this.keys.getAll();
    const match = Object.keys(keys).find((key) => keys[key].publicJWK.kid === header.kid);
    if (!match) throw new AuthTokenServiceError('signing key does not exist');
    return keys[match].publicKey;
  }

  private static async parseSecret(secret: string): Promise<AuthSigningKey> {
    const privateJWK: JWK = JSON.parse(secret);
    const publicJWK: JWK = { ...privateJWK, d: undefined };

    return {
      publicKey: await importJWK(publicJWK, 'EdDSA'),
      privateKey: await importJWK(privateJWK, 'EdDSA'),
      publicJWK,
      privateJWK,
    };
  }
}
