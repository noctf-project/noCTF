import type { JsonObject } from "@noctf/schema";
import type { DBType } from "../clients/database.ts";
import type { SerializableMap } from "../types/primitives.ts";
import { BadRequestError } from "../errors.ts";

export class ConfigDAO {
  async get<T extends SerializableMap>(db: DBType, namespace: string) {
    const config = await db
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
    db: DBType,
    namespace: string,
    value: T,
    version?: number,
  ) {
    let query = db
      .updateTable("config")
      .set((eb) => ({
        value: value as JsonObject,
        updated_at: new Date(),
        version: eb("version", "+", 1),
      }))
      .where("namespace", "=", namespace)
      .returning(["version"]);
    if (version || version === 0) {
      query = query.where("version", "=", version);
    }
    const result = await query.executeTakeFirst();
    if (!result) {
      throw new BadRequestError("config version mismatch");
    }
    return result.version;
  }
}
