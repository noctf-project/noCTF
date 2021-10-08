import { generateKeyPair } from 'jose/util/generate_key_pair';
import { exportJWK } from 'jose/key/export';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const SECRETS_DIR = '../../data/secrets/token-signature';
const KID_LENGTH = 16;

const generateSigningKey = async (path: string) => {
  const { privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const jwk = await exportJWK(privateKey);
  jwk.kid = createHash('sha256')
    .update(Math.floor(Date.now() / 1000).toString() + jwk.x)
    .digest()
    .slice(0, KID_LENGTH)
    .toString('base64url');
  
  fs.writeFileSync(path, JSON.stringify(jwk));
}

const main = async () => {
  // make the data directory
  fs.mkdirSync(SECRETS_DIR, {
    recursive: true
  });

  // generate the keys
  const primary = Math.floor(Date.now()/86400000) * 86400;
  await generateSigningKey(path.join(SECRETS_DIR, primary.toString()));
  await generateSigningKey(path.join(SECRETS_DIR, (primary - 86400).toString()));
};


main();