import { Announcement, LimitOffset } from "@noctf/api/datatypes";
import { DBType } from "../clients/database.ts";
import { AdminQueryAnnouncementsRequest } from "@noctf/api/requests";
import { sql, Updateable } from "kysely";
import { DB } from "@noctf/schema";
import { FilterUndefined } from "../util/filter.ts";
import { NotFoundError } from "../errors.ts";

const FIELDS = [
  "id",
  "title",
  "message",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "visible_to",
  "delivery_channels",
  "version",
] as const;

export class AnnouncementDAO {
  constructor(private readonly db: DBType) {}
  async create({
    title,
    message,
    created_by,
    updated_by,
    visible_to,
    delivery_channels,
  }: Omit<
    Announcement,
    "id" | "created_at" | "updated_at" | "version"
  >): Promise<Announcement> {
    const result = await this.db
      .insertInto("announcement")
      .values({
        title,
        message,
        created_by,
        updated_by,
        visible_to,
        delivery_channels,
      })
      .returning(["created_at", "updated_at", "id", "version"])
      .executeTakeFirstOrThrow();
    return {
      title,
      message,
      created_by,
      updated_by,
      visible_to,
      delivery_channels,
      ...result,
    };
  }

  async query(
    params?: Parameters<AnnouncementDAO["listQuery"]>[0],
    limit?: LimitOffset,
  ): Promise<Announcement[]> {
    let query = this.listQuery(params).select(FIELDS);

    if (limit?.limit) {
      query = query.limit(limit.limit);
    }
    if (limit?.offset) {
      query = query.limit(limit.offset);
    }
    return query.orderBy("updated_at desc").execute();
  }

  async get(id: number) {
    const result = await this.db
      .selectFrom("announcement")
      .select(FIELDS)
      .where("id", "=", id)
      .executeTakeFirst();
    if (!result) {
      throw new NotFoundError("Announcement not found");
    }
    return result;
  }

  async update(
    id: number,
    version?: number,
    v: Pick<
      Updateable<DB["announcement"]>,
      "title" | "message" | "updated_by" | "visible_to" | "delivery_channels"
    > = {},
  ) {
    let query = this.db
      .updateTable("announcement")
      .set((eb) => FilterUndefined({ ...v, version: eb("version", "+", 1) }))
      .where("id", "=", id)
      .returning(["updated_at", "version"]);

    if (version) {
      query = query.where("version", "=", version);
    }

    const result = await query.executeTakeFirst();
    if (!result) {
      throw new NotFoundError("Announcement and updated_at not found");
    }
    return result;
  }

  async delete(id: number, version?: number) {
    let query = this.db
      .deleteFrom("announcement")
      .where("id", "=", id)
      .returning(FIELDS);

    if (version) {
      query = query.where("version", "=", version);
    }
    const result = await query.executeTakeFirstOrThrow();
    if (!result) {
      throw new NotFoundError("Announcement and version not found");
    }
    return result;
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
