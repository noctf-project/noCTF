import pg from "pg";

export enum PostgresErrorCode {
  Duplicate = "23505",
  ForeignKeyViolation = "23503",
}

export const TryPGConstraintError = (
  e: Error,
  config: Partial<
    Record<
      PostgresErrorCode,
      {
        [key: string]: (e: pg.DatabaseError) => Error;
      }
    >
  >,
) => {
  if (!(e instanceof pg.DatabaseError)) return;
  if (e.code && config[e.code as PostgresErrorCode]) {
    const cfg = config[e.code as PostgresErrorCode]!; // typescript is dumb
    if (e.constraint && cfg[e.constraint]) {
      return cfg[e.constraint](e);
    }

    // hopefully there's no constraint called default
    if (cfg["default"]) {
      return cfg["default"](e);
    }
  }
};
