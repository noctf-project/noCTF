export const HOST = process.env.HOST || "localhost";
export const PORT = parseInt(process.env.PORT) || 8000;
export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["localhost"];
export const LOG_LEVEL = process.env.LOG_LEVEL || "info";
export const API_URL = process.env.API_URL || "http://localhost:8000";
export const POSTGRES_URL =
  process.env.POSTGRES_URL || "postgres://localhost/noctf";
export const NATS_URL = process.env.NATS_URL || "nats://localhost:4222";

export const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const TOKEN_SECRET = process.env.TOKEN_SECRET || "";

export const ENABLE_COMPRESSION = ["1", "true"].includes(
  (process.env.ENABLE_COMPRESSION || "").toLowerCase(),
);
export const ENABLE_HTTP2 = ["1", "true"].includes(
  (process.env.ENABLE_HTTP2 || "").toLowerCase(),
);
export const ENABLE_SWAGGER = ["1", "true"].includes(
  (process.env.ENABLE_SWAGGER || "").toLowerCase(),
);
export const DISABLE_RATE_LIMIT = ["1", "true"].includes(
  (process.env.DISABLE_RATE_LIMIT || "").toLowerCase(),
);

export const FILE_LOCAL_PATH = process.env.FILE_LOCAL_PATH || "files/";

export const METRICS_PATH = process.env.METRICS_PATH;
export const METRICS_FILE_NAME_FORMAT =
  process.env.METRICS_FILE_NAME_FORMAT || "metrics-%Y-%m-%d-%H.log";
