import type { IsolationLevel, Transaction } from "kysely";
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { DB } from "@noctf/schema";
import type { Logger } from "../types/primitives.ts";

export type DBType = Kysely<DB>;

export class DatabaseClient {
  private readonly client: DBType;

  constructor(logger: Logger | null, connectionString: string) {
    if (logger) {
      const url = new URL(connectionString);
      logger.info(`Connecting to postgres at ${url.host}:${url.port || 5432}`);
    }
    this.client = new Kysely<DB>({
      dialect: new PostgresDialect({
        pool: new pg.Pool({
          connectionString,
        }),
      }),
    });
  }

  async transaction<T>(
    cb: (t: Transaction<DB>) => Promise<T>,
    isolation?: IsolationLevel,
  ) {
    let tx = this.client.withSchema("public").transaction();
    if (isolation) {
      tx = tx.setIsolationLevel(isolation);
    }
    return tx.execute(cb);
  }

  get() {
    return this.client.withSchema("public");
  }
}
