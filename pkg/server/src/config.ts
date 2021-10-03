declare const process : {
  env: {
    NODE_ENV: string | undefined,
    PORT: string,
    NOCTF_SECRETS_DIR: string,
    NOCTF_SECRETS_WATCH: string,
    NOCTF_HOSTNAME: string,
    NOCTF_TOKEN_EXPIRY: string,
    NOCTF_DATABASE_CLIENT: string,
    NOCTF_DATABASE_CONNECTION_FILENAME: string,
    NOCTF_DATABASE_CONNECTION_NAME: string,
    NOCTF_DATABASE_CONNECTION_HOST: string,
    NOCTF_DATABASE_CONNECTION_USERNAME: string,
    NOCTF_DATABASE_CONNECTION_PASSWORD: string
  }
};

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = parseInt(process.env.PORT, 10) || 3000;
export const HOSTNAME = process.env.NOCTF_HOSTNAME || 'example.com';
export const TOKEN_EXPIRY = parseInt(process.env.NOCTF_TOKEN_EXPIRY, 10) || 3600;
export const SECRETS_DIR = process.env.NOCTF_SECRETS_DIR || './data/secrets';
export const SECRETS_WATCH = (
  !!process.env.NOCTF_SECRETS_WATCH
  && process.env.NOCTF_SECRETS_WATCH !== 'false'
);

export const DATABASE_CLIENT = process.env.NOCTF_DATABASE_CLIENT || 'sqlite3';

export const DATABASE_CONNECTION = {
  filename: process.env.NOCTF_DATABASE_CONNECTION_FILENAME || './data/noctf.db',
  database: process.env.NOCTF_DATABASE_CONNECTION_NAME,
  host: process.env.NOCTF_DATABASE_CONNECTION_HOST,
  username: process.env.NOCTF_DATABASE_CONNECTION_USERNAME,
  password: process.env.NOCTF_DATABASE_CONNECTION_PASSWORD,
};
