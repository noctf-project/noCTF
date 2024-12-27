import type {
  AdminCreateChallengeRequest,
  AdminUpdateChallengeRequest,
} from "@noctf/api/requests";
import type { DBType } from "../clients/database.ts";
import type {
  Challenge,
  ChallengeMetadata,
  ChallengeSummary,
} from "@noctf/api/datatypes";
import { FilterUndefined } from "../util/filter.ts";
import { NotFoundError } from "../errors.ts";
import { UpdateObject } from "kysely";
import { DB } from "@noctf/schema";
import { SelectExpression } from "kysely";

const METADATA_FIELDS: SelectExpression<DB, "core.challenge">[] = [
  "id",
  "slug",
  "title",
  "private_metadata",
  "tags",
  "hidden",
  "visible_at",
  "created_at",
  "updated_at",
];
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
    const { id, version, created_at, updated_at } = await db
      .insertInto("core.challenge")
      .values(values)
      .returning(["id", "version", "created_at", "updated_at"])
      .executeTakeFirst();

    return {
      ...values,
      id,
      version,
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
  ): Promise<ChallengeMetadata[]> {
    let query = db.selectFrom("core.challenge").select(METADATA_FIELDS);
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

    return (await query.execute()) as ChallengeMetadata[];
  }

  async getMetadata(db: DBType, id: number): Promise<ChallengeMetadata> {
    const challenge = await db
      .selectFrom("core.challenge")
      .select(METADATA_FIELDS)
      .where("id", "=", id)
      .executeTakeFirst();

    if (!challenge) {
      throw new NotFoundError("Challenge not found");
    }
    return challenge as ChallengeMetadata;
  }

  async get(db: DBType, id: number): Promise<Challenge> {
    const challenge = await db
      .selectFrom("core.challenge")
      .select([
        "id",
        "slug",
        "title",
        "description",
        "private_metadata",
        "tags",
        "hidden",
        "version",
        "visible_at",
        "created_at",
        "updated_at",
      ])
      .where("id", "=", id)
      .executeTakeFirst();

    if (!challenge) {
      throw new NotFoundError("Challenge not found");
    }
    return challenge as Challenge;
  }

  async update(db: DBType, id: number, v: AdminUpdateChallengeRequest) {
    const values: UpdateObject<DB, "core.challenge"> = {
      title: v.title,
      description: v.description,
      private_metadata: v.private_metadata,
      tags: v.tags,
      hidden: v.hidden,
      visible_at: v.visible_at,
      updated_at: new Date(),
    };
    let query = db
      .updateTable("core.challenge")
      .set(FilterUndefined(values))
      .set((eb) => ({ version: eb("version", "+", 1) }))
      .returning(["id", "version"])
      .where("id", "=", id);
    console.log(v.version);
    if (v.version || v.version === 0) {
      query = query.where("version", "=", v.version);
    }
    const result = await query.executeTakeFirst();
    if (!result) {
      throw new NotFoundError("Challenge and version not found");
    }
    return result;
  }

  async delete(db: DBType, id: number) {
    const { numDeletedRows } = await db
      .deleteFrom("core.challenge")
      .where("id", "=", id)
      .executeTakeFirst();
    if (!numDeletedRows) {
      throw new NotFoundError("Challenge not found");
    }
  }
}
