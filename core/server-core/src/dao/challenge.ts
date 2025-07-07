import type {
  AdminCreateChallengeRequest,
  AdminUpdateChallengeRequest,
} from "@noctf/api/requests";
import type { DBType } from "../clients/database.ts";
import type { Challenge, ChallengeMetadata } from "@noctf/api/datatypes";
import { FilterUndefined } from "../util/filter.ts";
import { ConflictError, NotFoundError } from "../errors.ts";
import type { UpdateObject } from "kysely";
import type { DB } from "@noctf/schema";
import type { SelectExpression } from "kysely";
import {
  PostgresErrorCode,
  PostgresErrorConfig,
  TryPGConstraintError,
} from "../util/pgerror.ts";

const METADATA_FIELDS: SelectExpression<DB, "challenge">[] = [
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

const CREATE_ERROR_CONFIG: PostgresErrorConfig = {
  [PostgresErrorCode.Duplicate]: {
    challenge_slug_key: () =>
      new ConflictError("The challenge slug already exists"),
  },
};

export class ChallengeDAO {
  constructor(private readonly db: DBType) {}

  async create(v: AdminCreateChallengeRequest): Promise<Challenge> {
    const values = {
      slug: v.slug,
      title: v.title,
      description: v.description,
      private_metadata: v.private_metadata,
      tags: v.tags,
      hidden: v.hidden,
      visible_at: v.visible_at,
    };
    try {
      const { id, version, created_at, updated_at } = await this.db
        .insertInto("challenge")
        .values(values)
        .returning(["id", "version", "created_at", "updated_at"])
        .executeTakeFirstOrThrow();

      return {
        ...values,
        id,
        version,
        created_at,
        updated_at,
      };
    } catch (e) {
      const pgerror = TryPGConstraintError(e, CREATE_ERROR_CONFIG);
      if (pgerror) throw pgerror;
      throw e;
    }
  }

  async list({
    tags,
    hidden,
    visible_at,
  }: Partial<Pick<Challenge, "tags" | "hidden" | "visible_at">>): Promise<
    ChallengeMetadata[]
  > {
    let query = this.db.selectFrom("challenge").select(METADATA_FIELDS);
    if (tags) {
      query = query.where("tags", "@>", tags);
    }
    if (typeof hidden === "boolean") {
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

    return (await query.execute()) as unknown as ChallengeMetadata[];
  }

  async get(idOrSlug: number | string): Promise<Challenge> {
    let query = this.db
      .selectFrom("challenge")
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
      ]);
    if (typeof idOrSlug === "number") {
      query = query.where("id", "=", idOrSlug);
    } else {
      query = query.where("slug", "=", idOrSlug);
    }
    const result = await query.executeTakeFirst();

    if (!result) {
      throw new NotFoundError("Challenge not found");
    }
    return result as Challenge;
  }

  async update(id: number, v: AdminUpdateChallengeRequest) {
    const values: UpdateObject<DB, "challenge"> = {
      title: v.title,
      description: v.description,
      private_metadata: v.private_metadata,
      tags: v.tags,
      hidden: v.hidden,
      visible_at: v.visible_at,
      updated_at: new Date(),
    };
    let query = this.db
      .updateTable("challenge")
      .set(FilterUndefined(values))
      .set((eb) => ({ version: eb("version", "+", 1) }))
      .returning(["version", "updated_at", "slug", "hidden"])
      .where("id", "=", id);
    if (v.version || v.version === 0) {
      query = query.where("version", "=", v.version);
    }
    const result = await query.executeTakeFirst();
    if (!result) {
      throw new NotFoundError("Challenge and version not found");
    }
    return result;
  }

  async delete(id: number) {
    const { numDeletedRows } = await this.db
      .deleteFrom("challenge")
      .where("id", "=", id)
      .executeTakeFirst();
    if (!numDeletedRows) {
      throw new NotFoundError("Challenge not found");
    }
  }
}
