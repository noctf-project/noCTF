import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockDeep, DeepMockProxy } from "vitest-mock-extended";
import { StatsService } from "./stats.ts";
import { UserService } from "./user.ts";
import { TeamService } from "./team.ts";
import { ChallengeService } from "./challenge/index.ts";
import { ConfigService } from "./config.ts";
import { DatabaseClient } from "../clients/database.ts";
import { SubmissionDAO } from "../dao/submission.ts";
import { ChallengeMetadata } from "@noctf/api/datatypes";

vi.mock(import("../dao/submission.ts"));

describe(StatsService, () => {
  let userService: DeepMockProxy<UserService>;
  let teamService: DeepMockProxy<TeamService>;
  let challengeService: DeepMockProxy<ChallengeService>;
  let configService: DeepMockProxy<ConfigService>;
  let databaseClient: DeepMockProxy<DatabaseClient>;
  let submissionDAO: DeepMockProxy<SubmissionDAO>;
  let service: StatsService;

  beforeEach(() => {
    userService = mockDeep<UserService>();
    teamService = mockDeep<TeamService>();
    challengeService = mockDeep<ChallengeService>();
    configService = mockDeep<ConfigService>();
    databaseClient = mockDeep<DatabaseClient>();
    submissionDAO = mockDeep<SubmissionDAO>();

    vi.mocked(SubmissionDAO).mockReturnValue(submissionDAO);

    service = new StatsService({
      userService,
      teamService,
      challengeService,
      configService,
      databaseClient,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getUserStats", () => {
    it("aggregates user, team, and tag counts", async () => {
      userService.getCount.mockResolvedValue(100);
      teamService.getCount.mockResolvedValueOnce(25);
      teamService.listTags.mockResolvedValue([
        {
          id: 1,
          name: "Undergrad",
          description: "",
          is_joinable: true,
          created_at: new Date(),
        },
        {
          id: 2,
          name: "HighSchool",
          description: "",
          is_joinable: true,
          created_at: new Date(),
        },
      ]);
      teamService.getCount.mockResolvedValueOnce(15);
      teamService.getCount.mockResolvedValueOnce(10);

      const stats = await service.getUserStats();

      expect(userService.getCount).toHaveBeenCalledWith({ flags: ["!hidden"] });
      expect(teamService.getCount).toHaveBeenCalledWith({ flags: ["!hidden"] });
      expect(stats).toEqual({
        user_count: 100,
        team_count: 25,
        team_tag_counts: [
          { id: 1, team_count: 15 },
          { id: 2, team_count: 10 },
        ],
      });
    });
  });

  describe("getChallengeStats", () => {
    it("returns empty array if there are no challenges", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {
          start_time_s: 1000,
          end_time_s: 2000,
        },
      });
      challengeService.list.mockResolvedValue([]);

      const result = await service.getChallengeStats(1);
      expect(result).toEqual([]);
    });

    it("returns challenge stats mapped with submission stats", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {
          start_time_s: 1000,
          end_time_s: 2000,
        },
      });
      challengeService.list.mockResolvedValue([
        {
          id: 101,
          slug: "crypto-1",
          title: "Crypto 1",
          private_metadata: {
            score: {
              params: {},
            },
          } as unknown as ChallengeMetadata["private_metadata"],
          tags: {},
          visible_at: new Date(1000),
          hidden: false,
          created_at: new Date(1000),
          updated_at: new Date(1000),
        },
      ]);
      submissionDAO.listStats.mockResolvedValue([
        {
          id: 101,
          challenge_id: 101,
          correct_count: 5,
          incorrect_count: 12,
          first_solve: new Date(1500),
          first_solve_team_id: 42,
        },
      ]);

      const result = await service.getChallengeStats(1);

      expect(submissionDAO.listStats).toHaveBeenCalledWith({
        challenge_ids: [101],
        division_id: 1,
        start: new Date(1000 * 1000),
        end: new Date(2000 * 1000),
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 101,
        released_at: new Date(1000),
        hidden: false,
        correct_count: 5,
        incorrect_count: 12,
        first_solve: new Date(1500),
        first_solve_team_id: 42,
      });
    });
  });
});
