import { DB } from "@noctf/schema";
import { DBType } from "../clients/database.ts";
import { Insertable } from "kysely";

export class SubmissionLogDAO {
  constructor(private readonly db: DBType) {}

  async create(v: Insertable<DB["submission_log"]>[]) {
    return await this.db
      .insertInto("submission_log")
      .values(v)
      .returning(["id", "created_at"])
      .execute();
  }

  // TODO: list
}
