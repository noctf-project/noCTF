import type { IsolationLevel, Transaction } from "kysely";
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { DB } from "@noctf/schema";
import type { Logger } from "../types/primitives.ts";
import { KeyService } from "../services/key.ts";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
import { decode, encode } from "cbor-x";
import { PaginationCursor } from "../types/pagination.ts";
import { BadRequestError } from "../errors.ts";

// Encoding version, forms part of the key as the server doesn't need to decode old versions
const DB_CURSOR_ENCODING_VERSION = 1;

export type DBType = Kysely<DB>;

export class DatabaseClient {
  private readonly client: DBType;

  constructor(
    logger: Logger | null,
    private readonly keyService: KeyService,
    connectionString: string,
  ) {
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

  encodePaginationToken(operation: string, data: PaginationCursor) {
    const key = this.keyService.deriveKey(
      `database:pagination:v${DB_CURSOR_ENCODING_VERSION}`,
    );
    const opKey = createHmac("sha256", key).update(operation).digest();
    const payload = encode(data);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", opKey, iv, {
      authTagLength: 12,
    });
    const encrypted = cipher.update(payload);
    cipher.final();
    const out = Buffer.concat([encrypted, iv, cipher.getAuthTag()]);
    return out.toString("base64url");
  }

  decodePaginationToken(operation: string, payload: string) {
    const buf = Buffer.from(payload, "base64url");
    if (buf.length < 24) {
      throw new BadRequestError(
        "InvalidPaginationToken",
        "Invalid pagination token",
        { cause: "Invalid pagination token length" },
      );
    }
    const key = this.keyService.deriveKey(
      `database:pagination:v${DB_CURSOR_ENCODING_VERSION}`,
    );
    const opKey = createHmac("sha256", key).update(operation).digest();
    const cipher = createDecipheriv(
      "aes-256-gcm",
      opKey,
      buf.subarray(buf.length - 24, 12),
    );
    cipher.setAuthTag(buf.subarray(buf.length - 12));
    const decrypted = cipher.update(buf.subarray(0, buf.length - 24));
    try {
      cipher.final();
    } catch (e) {
      throw new BadRequestError(
        "InvalidPaginationToken",
        "Invalid pagination token",
        { cause: e },
      );
    }
    const decoded: PaginationCursor = decode(decrypted);
    return decoded;
  }
}
