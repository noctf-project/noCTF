import type { JsonObject } from "@noctf/schema";
import type { DBType } from "../clients/database.ts";
import { BadRequestError } from "../errors.ts";
import { SerializableMap } from "@noctf/api/types";

export class ConfigDAO {
  constructor(private readonly db: DBType) {}
  async get<T extends SerializableMap>(namespace: string) {
    const config = await this.db
      .selectFrom("config")
      .select(["version", "value"])
      .where("namespace", "=", namespace)
      .executeTakeFirst();
    if (config) {
      return {
        version: config.version,
        value: config.value as T,
      };
    }
    return {
      version: 0,
      value: {} as T,
    };
  }

  async update<T extends SerializableMap>(
    namespace: string,
    value: T,
    version?: number,
  ) {
    let query = this.db
      .updateTable("config")
      .set((eb) => ({
        value: value as JsonObject,
        version: eb("version", "+", 1),
      }))
      .where("namespace", "=", namespace)
      .returning(["version", "updated_at"]);
    if (version || version === 0) {
      query = query.where("version", "=", version);
    }
    const result = await query.executeTakeFirst();
    if (!result) {
      throw new BadRequestError("config version mismatch");
    }
    return result;
  }

  async register<T extends SerializableMap>(namespace: string, value: T) {
    const result = await this.db
      .insertInto("config")
      .values({
        namespace,
        value: value as JsonObject,
      })
      .onConflict((c) => c.doNothing())
      .executeTakeFirst();
    return !!result.numInsertedOrUpdatedRows;
  }
}
