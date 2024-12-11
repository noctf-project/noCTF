export const HOST = process.env.HOST || "localhost";
export const PORT = parseInt(process.env.PORT) || 8000;
export const LOG_LEVEL = process.env.LOG_LEVEL || "info";
export const POSTGRES_URL =
  process.env.POSTGRES_URL || "postgres://localhost/noctf";

export const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
export const REDIS_CACHE_URL = process.env.REDIS_CACHE_URL || REDIS_URL;
export const REDIS_EVENT_URL = process.env.REDIS_EVENT_URL || REDIS_URL;

export const TOKEN_SECRET = process.env.TOKEN_SECRET || "keyboard-cat";
export const ENABLE_HTTP2 = ["1", "true"].includes(
  (process.env.ENABLE_HTTP2 || "").toLowerCase(),
);
