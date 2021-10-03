import { SignJWT } from 'jose/jwt/sign';
import { jwtVerify } from 'jose/jwt/verify';
import { createHash } from 'crypto';
import { importJWK } from 'jose/key/import';
import { JWK, JWSHeaderParameters, KeyLike } from 'jose/types';
import SecretsService, { QUALIFIER_TOKEN_SIGNATURE } from '../secrets';
import { AuthToken, Key } from './types';

// Truncate hash values
const TRUNCATE_HASH_LENGTH = 18;

export class AuthTokenServiceError extends Error {
}

export default class AuthTokenService {
  private primary?: Key;

  private secondary?: Key;

  constructor(private secrets: SecretsService, private hostname: string, private expiry: number) {
  }

  public async generate(clientId: string, userId: string, sessionId: string): Promise<String> {
    const key = await this.getPrimaryKey();
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
    return [
      (await this.getPrimaryKey()).publicJWK,
      (await this.getSecondaryKey()).publicJWK,
    ];
  }

  public async parse(token: string): Promise<AuthToken> {
    const parsed = await jwtVerify(token, this.getJWKForJWT.bind(this), {
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
  }

  private async getJWKForJWT(header: JWSHeaderParameters): Promise<KeyLike> {
    const primaryKey = await this.getPrimaryKey();
    if (primaryKey.publicJWK.kid === header.kid) {
      return primaryKey.publicKey;
    }

    const secondaryKey = await this.getSecondaryKey();
    if (secondaryKey.publicJWK.kid === header.kid) {
      return secondaryKey.publicKey;
    }

    throw new AuthTokenServiceError('unable to find a valid key');
  }

  private async getPrimaryKey(): Promise<Key> {
    const secret = await this.secrets.getSecret(
      QUALIFIER_TOKEN_SIGNATURE,
      'primary',
      this.primary?.version || 0,
    );
    if (!secret && this.primary) return this.primary;
    this.primary = await this.deserializeEd25519Key('primary', this.primary?.version || 0);
    return this.primary;
  }

  private async getSecondaryKey(): Promise<Key> {
    const secret = await this.secrets.getSecret(
      QUALIFIER_TOKEN_SIGNATURE,
      'secondary',
      this.secondary?.version,
    );
    if (!secret && this.secondary) return this.secondary;
    this.secondary = await this.deserializeEd25519Key('secondary', this.secondary?.version || 0);
    return this.secondary;
  }

  private async deserializeEd25519Key(name: string, version: number): Promise<Key> {
    const secret = await this.secrets.getSecret(QUALIFIER_TOKEN_SIGNATURE, name, version);
    if (!secret) throw new AuthTokenServiceError(`no ${name} key found in secrets`);
    const privateJWK = JSON.parse(secret[1]);
    const publicJWK = AuthTokenService.getPublicEd25519Key(privateJWK);

    return {
      version: secret[0],
      publicKey: await importJWK(publicJWK, 'EdDSA'),
      publicJWK,
      privateKey: await importJWK(privateJWK, 'EdDSA'),
      privateJWK,
    };
  }

  private static getPublicEd25519Key(privateKey: JWK): JWK {
    return {
      ...privateKey,
      d: undefined,
      kid: createHash('sha256')
        .update(privateKey.x || '')
        .digest()
        .slice(0, TRUNCATE_HASH_LENGTH)
        .toString('base64url'),
    };
  }
}
