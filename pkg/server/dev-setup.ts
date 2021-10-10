import { generateKeyPair } from 'jose/util/generate_key_pair';
import { exportJWK } from 'jose/key/export';
import { createHash } from 'crypto';
import { pki } from 'node-forge';
import * as fs from 'fs';
import * as path from 'path';

const SECRETS_DIR = '../../data/secrets';
const SECRETS_TOKEN_DIR = path.join(SECRETS_DIR, 'token-signature');
const SECRETS_HTTPS_DIR = path.join(SECRETS_DIR, 'https');
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

const generateCertificate = (keyFile: string, certFile: string) => {
  const keys = pki.rsa.generateKeyPair(2048);
  const privKey = pki.privateKeyToPem(keys.privateKey);

  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.setIssuer([
    {
      name: 'commonName',
      value: 'noCTF self-signed CA'
    }, {
      name: 'organizationName',
      value: 'certs'
    }
  ]);
  cert.setSubject([
    {
      name: 'commonName',
      value: 'localhost'
    }
  ])
  cert.sign(keys.privateKey);

  const pubKey = pki.certificateToPem(cert);
  fs.writeFileSync(keyFile, privKey);
  fs.writeFileSync(certFile, pubKey);
};

const main = async () => {
  // make the data directory
  fs.mkdirSync(SECRETS_TOKEN_DIR, {
    recursive: true
  });
  fs.mkdirSync(SECRETS_HTTPS_DIR, {
    recursive: true
  });

  // generate the keys
  const primary = Math.floor(Date.now()/86400000) * 86400;
  await generateSigningKey(path.join(SECRETS_TOKEN_DIR, primary.toString()));
  await generateSigningKey(path.join(SECRETS_TOKEN_DIR, (primary - 86400).toString()));

  // generate http certs
  generateCertificate(
    path.join(SECRETS_HTTPS_DIR, 'key.pem'),
    path.join(SECRETS_HTTPS_DIR, 'cert.pem')
  );
};


main();