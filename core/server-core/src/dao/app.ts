import { App } from "@noctf/api/datatypes";
import { DBType } from "../clients/database.ts";
import { NotFoundError } from "../errors.ts";

export class AppDAO {
  constructor(private readonly db: DBType) {}

  async getByActiveClientID(clientId: string): Promise<App> {
    const result = await this.db
      .selectFrom("app")
      .where("client_id", "=", clientId)
      .where("enabled", "=", true)
      .select([
        "id",
        "name",
        "client_id",
        "client_secret",
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
