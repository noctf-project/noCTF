import { beforeAll, afterAll } from "vitest";
import pg from "pg";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz", 10);

let clonedDbName: string;
let adminUrl: string;

beforeAll(async () => {
  const originalUrl = process.env.POSTGRES_URL;
  if (!originalUrl) {
    throw new Error(
      "POSTGRES_URL must be defined to run integration tests. Run via ./scripts/test-integ.sh",
    );
  }

  const baseUri = new URL(originalUrl);
  // Connect to default 'postgres' database for administrative commands
  adminUrl = `${baseUri.protocol}//${baseUri.username}:${baseUri.password}@${baseUri.host}/postgres`;

  clonedDbName = `test_${nanoid()}`;

  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();

  // Instant copy-on-write clone from the migrated template database 'noctf'
  await client.query(`CREATE DATABASE ${clonedDbName} TEMPLATE noctf;`);
  await client.end();

  // Point POSTGRES_URL to this isolated cloned database for this test file
  baseUri.pathname = `/${clonedDbName}`;
  process.env.POSTGRES_URL = baseUri.toString();
});

afterAll(async () => {
  if (adminUrl && clonedDbName) {
    const client = new pg.Client({ connectionString: adminUrl });
    await client.connect();
    // Force disconnect open connection pools and drop the database cleanly
    await client.query(`DROP DATABASE IF EXISTS ${clonedDbName} WITH (FORCE);`);
    await client.end();
  }
});
