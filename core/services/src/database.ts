import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { DB } from "@noctf/schema";

export class DatabaseService extends Kysely<DB> {
  constructor(connectionString: string) {
    super({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString,
        }),
      }),
    });
  }
}
