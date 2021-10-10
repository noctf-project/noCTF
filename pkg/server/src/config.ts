declare const process : {
  env: {
    NODE_ENV: string | undefined,
    PORT: string,
    NOCTF_SECRETS_DIR: string,
    NOCTF_SECRETS_WATCH: string,
    NOCTF_HOSTNAME: string,
    NOCTF_TOKEN_EXPIRY: string,
    NOCTF_DOCS_ENABLED: string,
    NOCTF_DATABASE_CLIENT: string,
    NOCTF_DATABASE_CONNECTION_NAME: string,
    NOCTF_DATABASE_CONNECTION_HOST: string,
    NOCTF_DATABASE_CONNECTION_USERNAME: string,
    NOCTF_DATABASE_CONNECTION_PASSWORD: string,
    NOCTF_REDIS_URL: string,
  }
};

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = parseInt(process.env.PORT, 10) || 3000;
export const HOSTNAME = process.env.NOCTF_HOSTNAME || 'localhost';
export const TOKEN_EXPIRY = parseInt(process.env.NOCTF_TOKEN_EXPIRY, 10) || 3600;
export const SECRETS_DIR = process.env.NOCTF_SECRETS_DIR || './data/secrets';
export const DOCS_ENABLED = process.env.NOCTF_DOCS_ENABLED
  ? process.env.NOCTF_DOCS_ENABLED !== 'false'
  : NODE_ENV === 'development';
export const SECRETS_WATCH = (
  !!process.env.NOCTF_SECRETS_WATCH
  && process.env.NOCTF_SECRETS_WATCH !== 'false'
);

export const DATABASE_CLIENT = process.env.NOCTF_DATABASE_CLIENT || 'postgresql';
export const DATABASE_CONNECTION = {
  database: process.env.NOCTF_DATABASE_CONNECTION_NAME,
  host: process.env.NOCTF_DATABASE_CONNECTION_HOST,
  user: process.env.NOCTF_DATABASE_CONNECTION_USERNAME,
  password: process.env.NOCTF_DATABASE_CONNECTION_PASSWORD,
};

export const REDIS_URL = process.env.NOCTF_REDIS_URL || 'redis://127.0.0.1:6379/';
