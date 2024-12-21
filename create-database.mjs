// Create a database given a postgres URL
import pg from "pg";

const url = new URL(process.env.POSTGRES_URL);
const dbname = url.pathname.substring(1);

async function waitForDb(retries) {
  url.pathname = "/";
  let i = 0;
  while (i < retries) {
    try {
      const client = new pg.Client(url.toString());
      await client.connect();
      return client;
    } catch (e) {
      console.error(`Try ${i + 1}: Connection failed: ${error.message}`);
      await new Promise((res) => setTimeout(res, 2000));
    }
  }
}
const client = await waitForDb(10);
if (process.env.DROP_DATABASE) {
  await client.query(`DROP DATABASE IF EXISTS ${dbname}`);
}
await client.query(`CREATE DATABASE ${dbname}`);
console.log("Created database", dbname);
await client.end();
