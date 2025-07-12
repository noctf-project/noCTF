import { defineConfig } from "kysely-ctl";
import type { MigrationProvider } from "kysely";
import { Pool } from "pg";
import { glob } from "node:fs/promises";
import { basename } from "node:path";

const MIGRATION_FILE_REGEX = /^[\d]+_.+\.ts$/;

class DevMigrationProvider implements MigrationProvider {
  async getMigrations() {
    const migrations = {};
    for await (const filename of glob([
      "migrations/*.ts",
      "plugins/*/migrations/*.ts",
    ])) {
      if (!basename(filename).match(MIGRATION_FILE_REGEX)) {
        continue;
      }
      migrations[filename] = await import(`./${filename}`);
    }
    return migrations;
  }
}

export default defineConfig({
  dialect: "pg",
  migrations: {
    provider: new DevMigrationProvider(),
  },
  dialectConfig: {
    pool: new Pool({
      connectionString: process.env.POSTGRES_URL,
    }),
  },
});
