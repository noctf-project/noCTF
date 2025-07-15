import { Announcement } from "@noctf/api/datatypes";
import { DBType } from "../clients/database.ts";
import { AdminQueryAnnouncementsRequest } from "@noctf/api/requests";
import { sql, Updateable } from "kysely";
import { DB } from "@noctf/schema";
import { FilterUndefined } from "../util/filter.ts";
import { NotFoundError } from "../errors.ts";

export class AnnouncementDAO {
  constructor(private readonly db: DBType) {}
  async create({
    title,
    message,
    created_by,
    updated_by,
    visible_to,
  }: Omit<Announcement, "id" | "created_at" | "updated_at">) {
    return this.db
      .insertInto("announcement")
      .values({
        title,
        message,
        created_by,
        updated_by,
        visible_to,
      })
      .execute();
  }

  async query(
    params?: Parameters<AnnouncementDAO["listQuery"]>[0],
    limit?: number,
  ): Promise<Announcement[]> {
    let query = this.listQuery(params).select([
      "id",
      "title",
      "message",
      "created_at",
      "updated_at",
      "created_by",
      "updated_by",
      "visible_to",
    ]);

    if (limit) {
      query = query.limit(limit);
    }
    return query.orderBy("updated_at desc").execute();
  }

  async update(
    id: number,
    v: Pick<
      Updateable<DB["announcement"]>,
      "title" | "message" | "updated_by" | "visible_to"
    >,
  ) {
    const { numUpdatedRows } = await this.db
      .updateTable("announcement")
      .set(FilterUndefined(v))
      .where("id", "=", id)
      .executeTakeFirst();
    if (!numUpdatedRows) {
      throw new NotFoundError("Announcement not found");
    }
  }

  async getCount(
    params?: Parameters<AnnouncementDAO["listQuery"]>[0],
  ): Promise<number> {
    return Number(
      (
        await this.listQuery(params)
          .select(this.db.fn.countAll().as("count"))
          .executeTakeFirstOrThrow()
      ).count,
    );
  }

  private listQuery({
    updated_at,
    visible_to,
  }: Omit<AdminQueryAnnouncementsRequest, "page_size"> = {}) {
    let query = this.db.selectFrom("announcement");

    if (updated_at) {
      if (updated_at[0]) query = query.where("updated_at", ">=", updated_at[0]);
      if (updated_at[1]) query = query.where("updated_at", "<=", updated_at[1]);
    }

    if (visible_to && visible_to.length) {
      query = query.where(
        "visible_to",
        "&&",
        sql<string[]>`ARRAY[${sql.join(visible_to)}]`,
      );
    }
    return query;
  }
}
