import { CacheClient } from "../clients/cache.ts";
import { DatabaseClient } from "../clients/database.ts";
import { NotFoundError } from "../errors.ts";
import { TeamFlag } from "../enums.ts";
import { CoreTeamMemberRole } from "@noctf/schema";

type Props = {
  databaseClient: DatabaseClient;
  cacheClient: CacheClient;
};

export class TeamService {
  private cacheClient: CacheClient;
  private databaseClient: DatabaseClient;

  constructor({ databaseClient, cacheClient }: Props) {
    this.cacheClient = cacheClient;
    this.databaseClient = databaseClient;
  }

  /**
   * Joins a user to a team using a joining code.
   * @param userId
   * @param code
   */
  async join(userId: number, code: string) {
    const { id: teamId, flags } = await this.databaseClient
      .selectFrom("core.team")
      .select(["id", "flags"])
      .where("join_code", "=", code)
      .executeTakeFirst();
    if (
      !teamId ||
      flags.includes(TeamFlag.FROZEN) ||
      flags.includes(TeamFlag.BLOCKED)
    ) {
      throw new NotFoundError("Cannot find joining code");
    }
    await this.assignTeam(userId, teamId);
  }

  async assignTeam(
    userId: number,
    teamId: number,
    role: CoreTeamMemberRole = "member",
  ) {
    await this.databaseClient.insertInto("core.team_member").values({
      user_id: userId,
      team_id: teamId,
      role,
    });
  }
}
