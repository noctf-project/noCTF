import { defineConfig } from "kysely-ctl";
import { MigrationProvider } from "kysely";
import { Pool } from "pg";
import { glob } from "node:fs/promises";

class DevMigrationProvider implements MigrationProvider {
  async getMigrations() {
    const migrations = {};
    for await (const filename of glob(["migrations/*.ts", "plugins/*/migrations/*.ts"])) {
      migrations[filename] = await import(`./${filename}`);
    }
    return migrations;
  }
}

export default defineConfig({
  dialect: 'pg',
  migrations: {
    provider: new DevMigrationProvider(),
  },
  dialectConfig: {
    pool: new Pool({
      connectionString: process.env.DATABASE_URL
    })
  }
});