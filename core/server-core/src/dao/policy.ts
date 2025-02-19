import { DBType } from "../clients/database.ts";

export class PolicyDAO {
  constructor(private readonly db: DBType) {}
  async getPermissionsForUser(userId: number) {
    return await this.db
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

  async getPermissionsForPublic() {
    return await this.db
      .selectFrom("policy")
      .select(["id", "permissions"])
      .where("public", "=", true)
      .execute();
  }
}
