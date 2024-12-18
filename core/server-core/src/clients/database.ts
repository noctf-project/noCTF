import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { DB } from "@noctf/schema";
import { Logger } from "../types/primitives.ts";

export type DBType = Kysely<DB>;

export class DatabaseClient extends Kysely<DB> {
  constructor(logger: Logger | null, connectionString: string) {
    if (logger) {
      const url = new URL(connectionString);
      logger.info(`Connecting to postgres at ${url.host}:${url.port || 5432}`);
    }
    super({
      dialect: new PostgresDialect({
        pool: new pg.Pool({
          connectionString,
        }),
      }),
    });
  }
}
