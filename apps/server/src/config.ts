export const HOST = process.env.HOST || "localhost";
export const PORT = parseInt(process.env.PORT) || 8000;
export const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://localhost/noctf";
export const TOKEN_SECRET = process.env.TOKEN_SECRET || "keyboard-cat";
