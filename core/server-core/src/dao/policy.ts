import type { DB } from "@noctf/schema";
import type { Kysely } from "kysely";

export class PolicyDAO {
  async getPermissionsForUser(db: Kysely<DB>, userId: number) {
    return await db
      .selectFrom("core.policy")
      .select(["core.policy.id", "core.policy.permissions"])
      .innerJoin("core.user", (join) =>
        join.on((eb) =>
          eb.and([
            eb.or([
              eb("core.policy.match_roles", "=", "{}" as unknown as string[]),
              eb("core.policy.match_roles", "&&", eb.ref("core.user.roles")),
            ]),
            eb.not(
              eb("core.user.roles", "&&", eb.ref("core.policy.omit_roles")),
            ),
          ]),
        ),
      )
      .where("core.user.id", "=", userId)
      .execute();
  }

  async getPermissionsForPublic(db: Kysely<DB>) {
    return await db
      .selectFrom("core.policy")
      .select(["id", "permissions"])
      .where("public", "=", true)
      .execute();
  }
}
