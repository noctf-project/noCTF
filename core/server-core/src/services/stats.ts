import { SetupConfig } from "@noctf/api/config";
import { SubmissionDAO } from "../dao/submission.ts";
import { ServiceCradle } from "../index.ts";
import { ChallengeStat } from "@noctf/api/datatypes";
import { LocalCache } from "../util/local_cache.ts";

type Props = Pick<
  ServiceCradle,
  | "userService"
  | "teamService"
  | "challengeService"
  | "configService"
  | "databaseClient"
>;

export class StatsService {
  private readonly userService;
  private readonly teamService;
  private readonly challengeService;
  private readonly configService;
  private readonly submissionDAO;

  private challengeConfigVersion: number;
  private readonly challengesCache = new LocalCache<number, ChallengeStat[]>({
    max: 100,
    ttl: 60000,
  });

  constructor({
    userService,
    teamService,
    challengeService,
    configService,
    databaseClient,
  }: Props) {
    this.userService = userService;
    this.teamService = teamService;
    this.challengeService = challengeService;
    this.configService = configService;
    this.submissionDAO = new SubmissionDAO(databaseClient.get());
  }

  async getUserStats() {
    const user_count = await this.userService.getCount({ flags: ["!hidden"] });
    const team_count = await this.teamService.getCount({ flags: ["!hidden"] });
    const tags = await this.teamService.listTags();
    const team_tag_counts = await Promise.all(
      tags.map(async ({ id }) => ({
        id,
        team_count: await this.teamService.getCount({ tag_ids: [id] }),
      })),
    );
    return { user_count, team_count, team_tag_counts };
  }

  async getChallengeStats(division_id: number) {
    const config = await this.configService.get(SetupConfig);

    if (config.version !== this.challengeConfigVersion) {
      this.challengesCache.clear();
      this.challengeConfigVersion = config.version;
    }
    return this.challengesCache.load(division_id, () =>
      this.fetchChallengeStats(config.value, division_id),
    );
  }

  private async fetchChallengeStats(
    config: SetupConfig,
    division_id: number,
  ): Promise<ChallengeStat[]> {
    const challenges = await this.challengeService.list({});
    if (!challenges) return [];
    const start = config.start_time_s
      ? new Date(config.start_time_s * 1000)
      : undefined;
    const end = config.end_time_s
      ? new Date(config.end_time_s * 1000)
      : undefined;
    const stats = new Map(
      (
        await this.submissionDAO.listStats({
          challenge_ids: challenges.map(({ id }) => id),
          division_id,
          start,
          end,
        })
      ).map((x) => [x.id, x]),
    );
    // TODO: consider frozen scoreboard
    const out: ChallengeStat[] = [];
    for (const challenge of challenges) {
      const stat = stats.get(challenge.id);
      out.push({
        id: challenge.id,
        released_at: challenge.visible_at || start || null,
        hidden: challenge.hidden,
        correct_count: stat?.correct_count || 0,
        incorrect_count: stat?.incorrect_count || 0,
        first_solve: stat?.first_solve || null,
        first_solve_team_id: stat?.first_solve_team_id || null,
      });
    }
    return out;
  }
}
