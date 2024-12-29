import type { DB } from "@noctf/schema";
import type { Kysely } from "kysely";

export class PolicyDAO {
  async getPermissionsForUser(db: Kysely<DB>, userId: number) {
    return await db
      .selectFrom("policy")
      .select(["policy.id", "policy.permissions"])
      .innerJoin("user", (join) =>
        join.on((eb) =>
          eb.and([
            eb.or([
              eb("policy.match_roles", "=", "{}" as unknown as string[]),
              eb("policy.match_roles", "&&", eb.ref("user.roles")),
            ]),
            eb.not(eb("user.roles", "&&", eb.ref("policy.omit_roles"))),
          ]),
        ),
      )
      .where("user.id", "=", userId)
      .execute();
  }

  async getPermissionsForPublic(db: Kysely<DB>) {
    return await db
      .selectFrom("policy")
      .select(["id", "permissions"])
      .where("public", "=", true)
      .execute();
  }
}
