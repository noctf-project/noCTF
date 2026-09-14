import pg from "pg";

export enum PostgresErrorCode {
  Duplicate = "23505",
  ForeignKeyViolation = "23503",
}
export type PostgresErrorConfig = Partial<
  Record<
    PostgresErrorCode,
    {
      [key: string]: (e: pg.DatabaseError) => Error;
    }
  >
>;

export const TryPGConstraintError = (
  e: unknown, // We intentionally don't want to verify if error is an actual pg error
  config: PostgresErrorConfig,
) => {
  const err = e as Partial<pg.DatabaseError> | undefined;
  if (err?.code && config[err.code as PostgresErrorCode]) {
    const cfg = config[err.code as PostgresErrorCode]!; // typescript is dumb
    if (err.constraint && cfg[err.constraint]) {
      return cfg[err.constraint](err as pg.DatabaseError);
    }

    // hopefully there's no constraint called default
    if (cfg["default"]) {
      return cfg["default"](err as pg.DatabaseError);
    }
  }
};
