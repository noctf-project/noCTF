import cbor from 'cbor';
import * as path from 'path';
import NodeCache from 'node-cache';
import { CompactSign } from 'jose/jws/compact/sign';
import { compactVerify } from 'jose/jws/compact/verify';
import { CompactEncrypt } from 'jose/jwe/compact/encrypt';
import { compactDecrypt } from 'jose/jwe/compact/decrypt'
import { importJWK } from 'jose/key/import';
import { JWSInvalid, JWSSignatureVerificationFailed } from 'jose/util/errors';
import { JWK } from 'jose/types';
import { BinaryLike, createHash, createHmac } from 'crypto';
import { AuthSigningKey, AuthToken, AuthTokenBase } from '../../util/types';
import logger from '../../util/logger';
import { TOKEN_EXPIRY } from '../../config';
import CacheService from '../cache';
import SecretRetriever from '../../util/secret_retriever';
import { now } from '../../util/helpers';
import { versions } from 'process';

const TOKEN_CACHE_TTL = 30;
const TOKEN_CACHE_CHECK = 120;
const TOKEN_MAX_KEYS = 10000;
const MAX_DRIFT = 60;
const CACHE_HIT_VALID = 1;
const CACHE_HIT_REVOKED = 2;
const TYPE_AUTH_TOKEN = 'auth';
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

  /**
   * Generate a session token
   * @param cid client id (0 for default)
   * @param uid user id
   * @param scope scope of token
   * @param sid session id
   * @returns access token
   */
  public async generate(cid: number, uid: number,
    scope: string[], sid: Uint8Array, maxExpires = this.expiry): Promise<string> {
    const ctime = now();

    const token: AuthToken = {
      typ: TYPE_AUTH_TOKEN,
      aud: this.hostname,
      cid,
      uid,
      sid,
      iat: ctime,
      exp: Math.min(ctime + this.expiry, ctime + maxExpires),
      scope,
    };

    const signed = await this.signPayload(token);

    const hash = createHash('sha256').update(signed).digest().toString('base64url');
    this.tokenCache.set(hash, CACHE_HIT_VALID, TOKEN_CACHE_TTL);
    return signed;
  }

  /**
   * Sign an arbitrary JSON payload as CBOR encoded JWS
   * @param payload JSON payload
   * @returns CBOR JWS token
   */
  public async signPayload(payload: AuthTokenBase): Promise<string> {
    const key = await this.getLatestKey();
    return new CompactSign(cbor.encode(payload))
      .setProtectedHeader({ alg: 'EdDSA', kid: key.publicJWK.kid })
      .sign(key.privateKey);
  }

  /**
   * Verify an arbitrary JWS token
   * @param payload token
   * @returns contents of token if successful
   */
  public async verifyPayload(token: string): Promise<{ kid: string, payload: AuthTokenBase }> {
    const ret = await compactVerify(
      token,
      async ({ kid }) => this.getSigningKeyForKid(kid!).publicKey,
    );
    return {
      payload: cbor.decode(ret.payload),
      kid: ret.protectedHeader.kid!,
    };
  }

  /**
   * Encrypt a CBOR payload with AES256 derived from private key
   * @param kid key id
   * @param payload payload
   * @returns JWE
   */
  public async encryptPayload(payload: AuthTokenBase): Promise<string> {
    const key = await this.getLatestKey();
    return await new CompactEncrypt(cbor.encode(payload))
      .setProtectedHeader({ kid: key.publicJWK.kid, enc: 'A256GCM', alg: 'dir' })
      .encrypt(key.symmetricKey);
  }

  /**
   * Decrypt a CBOR encoded JWE with kid derived from the private key
   * @param token JWE token to decrypt
   * @returns object
   */
  public async decryptPayload(token: string): Promise<{ kid: string, payload: AuthTokenBase }> {
    const ret = await compactDecrypt(
      token,
      async ({ kid }) => this.getSigningKeyForKid(kid!).symmetricKey,
    );
    return {
      payload: cbor.decode(ret.plaintext),
      kid: ret.protectedHeader.kid!,
    };
  }

  /**
   * Sign a HMAC with the specified key id
   * @param kid key id
   * @param payload payload
   * @param alg algorithm (default: sha256)
   * @returns hash digest
   */
  public signHMAC(kid: string, payload: BinaryLike, alg = 'sha256'): Buffer {
    const key = this.getSigningKeyForKid(kid);
    if (!key) throw new AuthTokenServiceError('kid doesn\'t exist');
    return createHmac(alg, key.symmetricKey).update(payload).digest();
  }

  private async checkRevocation(sid: ArrayBuffer): Promise<boolean> {
    return !!(await this.externalCache.get(
      `${REVOKED_KEY}:${Buffer.from(sid).toString('base64url')}`,
    ));
  }

  /**
   * Revoke a session ID
   * @param sid session id
   */
  public async revoke(sid: ArrayBuffer) {
    await this.externalCache.setex(
      `${REVOKED_KEY}:${Buffer.from(sid).toString('base64url')}`,
      this.expiry + MAX_DRIFT,
      '1',
    );
  }

  /**
   * Get a list of public keys
   * @returns JWK public keys
   */
  public async getPublicJWKs(): Promise<JWK[]> {
    const keys = this.keys.getAll();
    return Object.keys(keys).map((key) => keys[key].publicJWK);
  }

  /**
   * Parse an auth token and check its expiry
   * @param token auth token
   * @returns AuthToken if successful
   */
  public async parse(token: string): Promise<AuthToken> {
    const hash = createHash('sha256').update(token).digest().toString('base64url');
    const value: (number | undefined) = this.tokenCache.get(hash);

    if (!value) {
      return this.rawParse(token, hash);
    } if (value === CACHE_HIT_VALID) {
      // Token already validated
      const data = cbor.decode(Buffer.from(token.split('.')[1], 'base64url'));
      return this.validateClaims(data);
    } if (value === CACHE_HIT_REVOKED) {
      throw new AuthTokenServiceError('revoked');
    }
    throw new AuthTokenServiceError('unknown token error');
  }

  private async rawParse(token: string, hash: string): Promise<AuthToken> {
    const ctime = now();

    try {
      const payload = await this.verifyPayload(token);
      const claims = this.validateClaims(payload.payload as AuthToken);
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

  private validateClaims(token: AuthToken): AuthToken {
    const ctime = now();
    if (token.typ !== TYPE_AUTH_TOKEN) {
      throw new AuthTokenServiceError('invalid type');
    }

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

    if (!token.sid || (!token.cid && token.cid !== 0) || !token.uid) {
      this.log.error({ token }, 'invalid token format');
      throw new AuthTokenServiceError('invalid token format');
    }

    // add scope if its missing
    /* eslint-disable no-param-reassign */
    if (!token.scope) {
      token.scope = [];
    }

    return token;
  }

  private async getLatestKey(): Promise<AuthSigningKey> {
    const keys = await this.keys.getAll();
    // Get the first suitable key (key with an id greater than the current time)
    const version = Object.keys(keys)
      .map(parseInt)
      .filter((v) => !!v)
      .sort((a, b) => b - a)
      .find((id) => id <= now());
    if (!version) {
      throw new AuthTokenServiceError('cannot find suitable signing key');
    }
    return keys[version];
  }

  private getSigningKeyForKid(kid: string): AuthSigningKey {
    const keys = this.keys.getAll();
    const match = Object.keys(keys).find((key) => keys[key].publicJWK.kid === kid);
    if (!match) throw new AuthTokenServiceError('signing key does not exist');
    return keys[match];
  }

  private static async parseSecret(secret: string): Promise<AuthSigningKey> {
    const privateJWK: JWK = JSON.parse(secret);
    const publicJWK: JWK = { ...privateJWK, d: undefined };
    const symmetricKey = createHash('sha256').update(privateJWK.d!).digest();

    return {
      publicKey: await importJWK(publicJWK, 'EdDSA'),
      privateKey: await importJWK(privateJWK, 'EdDSA'),
      publicJWK,
      privateJWK,
      symmetricKey,
    };
  }
}
