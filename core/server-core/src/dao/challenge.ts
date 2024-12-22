import {
  AdminCreateChallengeRequest,
  AdminUpdateChallengeRequest,
} from "@noctf/api/requests";
import type { DBType } from "../clients/database.ts";
import { Challenge, ChallengeSummary } from "@noctf/api/datatypes";
import { FilterUndefined } from "../util/filter.ts";
import { BadRequestError, NotFoundError } from "../errors.ts";
import {
  MergeQueryBuilder,
  Selectable,
  SelectQueryBuilder,
  WhereInterface,
} from "kysely";
import { DB } from "@noctf/schema";

export class ChallengeDAO {
  async create(db: DBType, v: AdminCreateChallengeRequest): Promise<Challenge> {
    const values = {
      slug: v.slug,
      title: v.title,
      description: v.description,
      private_metadata: v.private_metadata,
      tags: v.tags,
      hidden: v.hidden,
      visible_at: v.visible_at,
    };
    const { id, created_at, updated_at } = await db
      .insertInto("core.challenge")
      .values(values)
      .returning(["id", "created_at", "updated_at"])
      .executeTakeFirst();

    return {
      ...values,
      id,
      created_at,
      updated_at,
    };
  }

  async list(
    db: DBType,
    {
      tags,
      hidden,
      visible_at,
    }: Partial<Pick<Challenge, "tags" | "hidden" | "visible_at">>,
  ): Promise<ChallengeSummary[]> {
    let query = db
      .selectFrom("core.challenge")
      .select([
        "id",
        "slug",
        "title",
        "tags",
        "hidden",
        "visible_at",
        "created_at",
        "updated_at",
      ]);
    if (tags) {
      query = query.where("tags", "@>", tags);
    }
    if (hidden) {
      query = query.where("hidden", "=", hidden);
    }
    if (visible_at) {
      query = query.where((eb) =>
        eb.or([
          eb("visible_at", "<=", visible_at),
          eb("visible_at", "is", null),
        ]),
      );
    }

    return (await query.execute()) as ChallengeSummary[];
  }

  async get(db: DBType, id_or_slug: string | number): Promise<Challenge> {
    const query = db
      .selectFrom("core.challenge")
      .select([
        "id",
        "slug",
        "title",
        "description",
        "private_metadata",
        "tags",
        "hidden",
        "visible_at",
        "created_at",
        "updated_at",
      ]);

    const challenge = await this.resolveIdOrSlug(
      query,
      id_or_slug,
    ).executeTakeFirst();

    if (!challenge) {
      throw new NotFoundError("Challenge not found");
    }
    return challenge as Challenge;
  }

  async update(
    db: DBType,
    id: number,
    v: AdminUpdateChallengeRequest,
  ) {
    const values: AdminUpdateChallengeRequest & { updated_at: Date } = {
      title: v.title,
      description: v.description,
      private_metadata: v.private_metadata,
      tags: v.tags,
      hidden: v.hidden,
      visible_at: v.visible_at,
      updated_at: new Date(),
    };
    const result = db.updateTable("core.challenge")
      .set(FilterUndefined(values))
      .where('id', '=', id)
      .returning("id")
      .executeTakeFirst();
    if (!result) {
      throw new NotFoundError("Challenge not found");
    }
  }

  private resolveIdOrSlug<T extends WhereInterface<DB, "core.challenge">>(
    q: T,
    id_or_slug: string | number,
  ): T {
    if (typeof id_or_slug === "number") {
      return q.where("id", "=", id_or_slug) as T;
    } else {
      return q.where("slug", "=", id_or_slug) as T;
    }
  }
}
