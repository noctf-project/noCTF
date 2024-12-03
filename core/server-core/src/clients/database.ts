import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { DB } from "@noctf/schema";
import { Logger } from "../types.ts";

export class DatabaseClient extends Kysely<DB> {
  constructor(connectionString: string, logger?: Logger) {
    if (logger) {
      const url = new URL(connectionString);
      logger.info(`Connecting to postgres at ${url.host}`);
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
