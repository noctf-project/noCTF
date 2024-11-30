export const HOST = process.env.HOST || "localhost";
export const PORT = parseInt(process.env.PORT) || 8000;
export const POSTGRES_URL =
  process.env.POSTGRES_URL || "postgres://localhost/noctf";
export const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
export const TOKEN_SECRET = process.env.TOKEN_SECRET || "keyboard-cat";
