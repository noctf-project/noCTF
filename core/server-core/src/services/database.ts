import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { DB } from "@noctf/schema";

export class DatabaseService extends Kysely<DB> {
  constructor(connectionString: string) {
    super({
      dialect: new PostgresDialect({
        pool: new pg.Pool({
          connectionString,
        }),
      }),
    });
  }
}
