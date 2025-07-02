import { DB } from "@noctf/schema";
import { DBType } from "../clients/database.ts";
import { NotFoundError } from "../errors.ts";
import { Selectable } from "kysely";

export type DBApp = Pick<
  Selectable<DB["app"]>,
  | "id"
  | "name"
  | "client_id"
  | "client_secret_hash"
  | "redirect_uris"
  | "scopes"
  | "enabled"
  | "created_at"
  | "updated_at"
>;
export class AppDAO {
  constructor(private readonly db: DBType) {}

  async getByActiveClientID(clientId: string): Promise<DBApp> {
    const result = await this.db
      .selectFrom("app")
      .where("client_id", "=", clientId)
      .where("enabled", "=", true)
      .select([
        "id",
        "name",
        "client_id",
        "client_secret_hash",
        "redirect_uris",
        "scopes",
        "enabled",
        "created_at",
        "updated_at",
      ])
      .executeTakeFirst();
    if (!result) throw new NotFoundError("App not found");
    return result;
  }
}
