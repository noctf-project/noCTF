import { DB } from "@noctf/schema";
import { DBType } from "../clients/database.ts";
import { ConflictError, NotFoundError } from "../errors.ts";
import { Selectable, Insertable } from "kysely";
import {
  PostgresErrorCode,
  PostgresErrorConfig,
  TryPGConstraintError,
} from "../util/pgerror.ts";

const CREATE_ERROR_CONFIG: PostgresErrorConfig = {
  [PostgresErrorCode.Duplicate]: {
    default: (e) =>
      new ConflictError("A duplicate entry was detected", { cause: e }),
  },
};

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

export type CreateUpdateAppData = Pick<
  Insertable<DB["app"]>,
  | "name"
  | "client_id"
  | "client_secret_hash"
  | "redirect_uris"
  | "scopes"
  | "enabled"
>;

const LISTABLE_FIELDS = [
  "id",
  "name",
  "client_id",
  "client_secret_hash",
  "redirect_uris",
  "scopes",
  "enabled",
  "created_at",
  "updated_at",
] as const;

export class AppDAO {
  constructor(private readonly db: DBType) {}

  async getByActiveClientID(clientId: string): Promise<DBApp> {
    const result = await this.db
      .selectFrom("app")
      .where("client_id", "=", clientId)
      .where("enabled", "=", true)
      .select(LISTABLE_FIELDS)
      .executeTakeFirst();
    if (!result) throw new NotFoundError("App not found");
    return result;
  }

  async list(): Promise<DBApp[]> {
    return await this.db
      .selectFrom("app")
      .select(LISTABLE_FIELDS)
      .orderBy("created_at", "desc")
      .execute();
  }

  async create(data: CreateUpdateAppData): Promise<DBApp> {
    try {
      const result = await this.db
        .insertInto("app")
        .values(data)
        .returning(LISTABLE_FIELDS)
        .executeTakeFirstOrThrow();
      return result;
    } catch (e) {
      const pgerror = TryPGConstraintError(e, CREATE_ERROR_CONFIG);
      if (pgerror) throw pgerror;
      throw e;
    }
  }

  async update(id: number, data: CreateUpdateAppData): Promise<DBApp> {
    try {
      const result = await this.db
        .updateTable("app")
        .set(data)
        .where("id", "=", id)
        .returning(LISTABLE_FIELDS)
        .executeTakeFirst();
      if (!result) throw new NotFoundError("App not found");
      return result;
    } catch (e) {
      const pgerror = TryPGConstraintError(e, CREATE_ERROR_CONFIG);
      if (pgerror) throw pgerror;
      throw e;
    }
  }

  async delete(id: number): Promise<void> {
    const result = await this.db
      .deleteFrom("app")
      .where("id", "=", id)
      .executeTakeFirst();
    if (!result.numDeletedRows) {
      throw new NotFoundError("App not found");
    }
  }
}
