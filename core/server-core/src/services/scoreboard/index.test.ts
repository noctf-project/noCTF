import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScoreboardService } from "./index.ts";
import { DeepMockProxy, mockDeep } from "vitest-mock-extended";
import { DivisionDAO } from "../../dao/division.ts";
import { ScoreboardDataLoader } from "./loader.ts";
import { ScoreboardHistory } from "./history.ts";
import { AwardDAO } from "../../dao/award.ts";
import { SubmissionDAO } from "../../dao/submission.ts";
import { TeamDAO } from "../../dao/team.ts";
import { ConfigService } from "../config.ts";
import { ChallengeService } from "../challenge/index.ts";
import { ScoreService } from "../score.ts";
import { DatabaseClient } from "../../clients/database.ts";
import { RedisClientFactory } from "../../clients/redis.ts";
import { Logger } from "../../types/primitives.ts";
import { Expression } from "expr-eval";
import { ChallengePrivateMetadataBase } from "@noctf/api/datatypes";

vi.mock(import("../../dao/division.ts"));
vi.mock(import("../../dao/award.ts"));
vi.mock(import("../../dao/submission.ts"));
vi.mock(import("../../dao/team.ts"));
vi.mock(import("./loader.ts"));
vi.mock(import("./history.ts"));

describe(ScoreboardService, () => {
  let configService: DeepMockProxy<ConfigService>;
  let challengeService: DeepMockProxy<ChallengeService>;
  let scoreService: DeepMockProxy<ScoreService>;
  let databaseClient: DeepMockProxy<DatabaseClient>;
  let redisClientFactory: DeepMockProxy<RedisClientFactory>;
  let logger: DeepMockProxy<Logger>;

  let scoreboardDataLoader: DeepMockProxy<ScoreboardDataLoader>;
  let scoreboardHistory: DeepMockProxy<ScoreboardHistory>;
  let divisionDAO: DeepMockProxy<DivisionDAO>;
  let teamDAO: DeepMockProxy<TeamDAO>;
  let submissionDAO: DeepMockProxy<SubmissionDAO>;
  let awardDAO: DeepMockProxy<AwardDAO>;

  let service: ScoreboardService;

  beforeEach(() => {
    configService = mockDeep<ConfigService>();
    challengeService = mockDeep<ChallengeService>();
    scoreService = mockDeep<ScoreService>();
    databaseClient = mockDeep<DatabaseClient>();
    redisClientFactory = mockDeep<RedisClientFactory>();
    logger = mockDeep<Logger>();

    scoreboardDataLoader = mockDeep<ScoreboardDataLoader>();
    scoreboardHistory = mockDeep<ScoreboardHistory>();
    divisionDAO = mockDeep<DivisionDAO>();
    teamDAO = mockDeep<TeamDAO>();
    submissionDAO = mockDeep<SubmissionDAO>();
    awardDAO = mockDeep<AwardDAO>();

    vi.mocked(ScoreboardDataLoader).mockImplementation(function () {
      return scoreboardDataLoader;
    });
    vi.mocked(ScoreboardHistory).mockImplementation(function () {
      return scoreboardHistory;
    });
    vi.mocked(DivisionDAO).mockImplementation(function () {
      return divisionDAO;
    });
    vi.mocked(TeamDAO).mockImplementation(function () {
      return teamDAO;
    });
    vi.mocked(SubmissionDAO).mockImplementation(function () {
      return submissionDAO;
    });
    vi.mocked(AwardDAO).mockImplementation(function () {
      return awardDAO;
    });

    service = new ScoreboardService({
      configService,
      challengeService,
      scoreService,
      databaseClient,
      redisClientFactory,
      logger,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  describe("resolveVersion / public scoreboard queries", () => {
    it("returns latest pointer when competition is not frozen", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: { freeze_time_s: 1000 },
      });
      vi.setSystemTime(new Date(999 * 1000));
      scoreboardDataLoader.getPointers.mockResolvedValue({ latest: 5000 });
      scoreboardDataLoader.getScoreboard.mockResolvedValue({
        total: 1,
        entries: [],
      });

      const result = await service.getScoreboard(1, 0, 10, undefined);

      expect(scoreboardDataLoader.getPointers).toHaveBeenCalledWith(1, [
        "latest",
        "frozen",
      ]);
      expect(scoreboardDataLoader.getScoreboard).toHaveBeenCalledWith(
        1,
        5000,
        0,
        10,
        undefined,
      );
      expect(result).toEqual({ total: 1, entries: [] });
    });

    it("returns frozen pointer when freeze_time_s has passed without pointer override", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: { freeze_time_s: 1000 },
      });
      vi.setSystemTime(new Date(1005 * 1000));
      scoreboardDataLoader.getPointers.mockResolvedValue({
        frozen: 1000000,
        latest: 1005000,
      });

      await service.getScoreboard(1, 0, 10, undefined);

      expect(scoreboardDataLoader.getPointers).toHaveBeenCalledWith(1, [
        "latest",
        "frozen",
      ]);
      expect(scoreboardDataLoader.getScoreboard).toHaveBeenCalledWith(
        1,
        1000000,
        0,
        10,
        undefined,
      );
    });

    it("returns latest pointer when freeze_time_s has passed with pointer override", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: { freeze_time_s: 1000 },
      });
      vi.setSystemTime(new Date(1005 * 1000));
      scoreboardDataLoader.getPointers.mockResolvedValue({
        frozen: 1000000,
        latest: 1005000,
      });

      await service.getScoreboard(1, 0, 10, undefined, "latest");

      expect(scoreboardDataLoader.getPointers).toHaveBeenCalledWith(1, [
        "latest",
        "frozen",
      ]);
      expect(scoreboardDataLoader.getScoreboard).toHaveBeenCalledWith(
        1,
        1005000,
        0,
        10,
        undefined,
      );
    });

    it("falls back to latest pointer when frozen is active but p:frozen does not exist yet", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: { freeze_time_s: 1000 },
      });
      vi.setSystemTime(new Date(1005 * 1000));
      scoreboardDataLoader.getPointers.mockResolvedValue({ latest: 1005000 });

      await service.getScoreboard(1, 0, 10, undefined);

      expect(scoreboardDataLoader.getPointers).toHaveBeenCalledWith(1, [
        "latest",
        "frozen",
      ]);
      expect(scoreboardDataLoader.getScoreboard).toHaveBeenCalledWith(
        1,
        1005000,
        0,
        10,
        undefined,
      );
    });

    it("returns empty scoreboard if pointer does not exist", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {},
      });
      scoreboardDataLoader.getPointers.mockResolvedValue({});

      const result = await service.getScoreboard(1, 0, 10, undefined);
      expect(result).toEqual({ total: 0, entries: [] });
      expect(scoreboardDataLoader.getScoreboard).not.toHaveBeenCalled();
    });

    it("passes pointer override through for getTeam, getTeamRank, getChallengesSummary, getChallengeSolves", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: { freeze_time_s: 1000 },
      });
      vi.setSystemTime(new Date(1005 * 1000));
      scoreboardDataLoader.getPointers.mockResolvedValue({
        frozen: 1000000,
        latest: 1005000,
      });

      // Default (no pointer override) resolves frozen
      await service.getTeam(1, 42);
      expect(scoreboardDataLoader.getTeam).toHaveBeenCalledWith(1, 1000000, 42);

      await service.getTeamRank(1, 42, undefined);
      expect(scoreboardDataLoader.getTeamRank).toHaveBeenCalledWith(
        1,
        1000000,
        42,
        undefined,
      );

      await service.getChallengesSummary(1);
      expect(scoreboardDataLoader.getChallengeSummary).toHaveBeenCalledWith(
        1,
        1000000,
      );

      await service.getChallengeSolves(1, 99);
      expect(scoreboardDataLoader.getChallengeSolves).toHaveBeenCalledWith(
        1,
        1000000,
        99,
      );

      // Pointer override to "latest" resolves latest
      await service.getTeam(1, 42, "latest");
      expect(scoreboardDataLoader.getTeam).toHaveBeenCalledWith(1, 1005000, 42);

      await service.getTeamRank(1, 42, undefined, "latest");
      expect(scoreboardDataLoader.getTeamRank).toHaveBeenCalledWith(
        1,
        1005000,
        42,
        undefined,
      );

      await service.getChallengesSummary(1, "latest");
      expect(scoreboardDataLoader.getChallengeSummary).toHaveBeenCalledWith(
        1,
        1005000,
      );

      await service.getChallengeSolves(1, 99, "latest");
      expect(scoreboardDataLoader.getChallengeSolves).toHaveBeenCalledWith(
        1,
        1005000,
        99,
      );
    });

    it("returns full score history when start and end times are not configured", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {},
      });
      scoreboardDataLoader.getPointers.mockResolvedValue({ latest: 5000000 });
      scoreboardDataLoader.getRanks.mockResolvedValue([1, [5]]);

      const teamHistory: [number[], number[]] = [
        [100, 20],
        [100, 500],
      ];
      scoreboardHistory.getHistoryForTeams.mockResolvedValue(
        new Map([[5, teamHistory]]),
      );

      const result = await service.getTeamScoreHistory([5]);
      expect(result.get(5)).toEqual([
        [100, 20],
        [100, 500],
      ]);
    });

    it("returns freeze date if freeze_time_s has elapsed, otherwise null", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: { freeze_time_s: 1000 },
      });

      vi.setSystemTime(new Date(900 * 1000));
      expect(await service.getFreezeTime()).toBeNull();

      vi.setSystemTime(new Date(1000 * 1000));
      expect(await service.getFreezeTime()).toEqual(new Date(1000 * 1000));

      vi.setSystemTime(new Date(1500 * 1000));
      expect(await service.getFreezeTime()).toEqual(new Date(1000 * 1000));
    });
  });

  describe("computeAndSaveScoreboards & commitDivisionForPointer", () => {
    const exprMock = mockDeep<Expression>();

    beforeEach(() => {
      exprMock.variables.mockReturnValue(["ctx.n"]);
      exprMock.simplify.mockReturnValue({
        evaluate: () => 100,
      } as unknown as Expression);
      scoreService.getExpr.mockResolvedValue(exprMock);

      divisionDAO.list.mockResolvedValue([
        {
          id: 1,
          name: "Default",
          slug: "default",
          description: "",
          is_visible: true,
          is_joinable: true,
          created_at: new Date(0),
        },
      ]);
      teamDAO.listForScoreboard.mockResolvedValue([
        { id: 10, division_id: 1, flags: [], tag_ids: [] },
      ]);
      challengeService.list.mockResolvedValue([
        {
          id: 100,
          slug: "chal-1",
          title: "Chal 1",
          hidden: false,
          visible_at: null,
          created_at: new Date(0),
          updated_at: new Date(0),
          tags: {},
          private_metadata: {
            score: { strategy: "dynamic", params: {} },
          } as unknown as ChallengePrivateMetadataBase,
        },
      ]);
    });

    it("skips non-latest snapshot if freeze_time_s has not yet occurred", async () => {
      const freezeTimeS = 1000;
      vi.setSystemTime(new Date(999 * 1000)); // Before freeze

      configService.get.mockResolvedValue({
        version: 1,
        value: { freeze_time_s: freezeTimeS },
      });
      // division needs calculation
      scoreboardDataLoader.getPointers.mockResolvedValue({});
      submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
      awardDAO.getAllAwards.mockResolvedValue([]);

      await service.computeAndSaveScoreboards(new Date(999 * 1000));

      // Should only saveIndexed for "latest", NOT "frozen"
      expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);
      expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledWith(
        1,
        expect.any(Number),
        expect.any(Array),
        expect.any(Map),
        "latest",
      );
      expect(scoreboardHistory.saveIteration).toHaveBeenCalledTimes(1);
    });

    it("computes and saves frozen snapshot when freeze_time_s is reached", async () => {
      const freezeTimeS = 1000;
      vi.setSystemTime(new Date(1005 * 1000)); // 5s after freeze

      configService.get.mockResolvedValue({
        version: 1,
        value: { freeze_time_s: freezeTimeS },
      });
      // division latest pointer is old, so it needs recalculation
      scoreboardDataLoader.getPointers.mockResolvedValue({
        latest: 900 * 1000,
      });

      // Submissions before and after freeze
      submissionDAO.getSolvesForCalculation.mockResolvedValue([
        {
          id: 1,
          team_id: 10,
          challenge_id: 100,
          created_at: new Date(500 * 1000), // Before freeze
          updated_at: new Date(500 * 1000),
          user_id: 1,
          weight: 0,
          hidden: false,
          value: null,
        },
        {
          id: 2,
          team_id: 10,
          challenge_id: 100,
          created_at: new Date(1002 * 1000), // After freeze!
          updated_at: new Date(1002 * 1000),
          user_id: 1,
          weight: 0,
          hidden: false,
          value: null,
        },
      ]);
      awardDAO.getAllAwards.mockResolvedValue([]);

      await service.computeAndSaveScoreboards(new Date(1005 * 1000));

      // Should saveIndexed twice: once for "frozen", once for "latest"
      expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(2);

      // Frozen snapshot: version is freeze_time_s * 1000 (1,000,000)
      expect(scoreboardDataLoader.saveIndexed).toHaveBeenNthCalledWith(
        1,
        1,
        1000 * 1000,
        expect.any(Array),
        expect.any(Map),
        "frozen",
      );

      // Verify that the frozen snapshot clamped updated_at and last_solve to freeze_time
      const frozenScoreboard =
        scoreboardDataLoader.saveIndexed.mock.calls[0][2];
      for (const entry of frozenScoreboard) {
        expect(entry.updated_at.getTime()).toBeLessThanOrEqual(1000 * 1000);
        expect(entry.last_solve.getTime()).toBeLessThanOrEqual(1000 * 1000);
      }

      // Latest snapshot: pointer is "latest", version is 1005 * 1000
      expect(scoreboardDataLoader.saveIndexed).toHaveBeenNthCalledWith(
        2,
        1,
        1005 * 1000,
        expect.any(Array),
        expect.any(Map),
        "latest",
      );

      // history.saveIteration should only be called once, for latest
      expect(scoreboardHistory.saveIteration).toHaveBeenCalledTimes(1);
    });

    it("touches existing frozen snapshot without recomputing if already at targetVersion", async () => {
      const freezeTimeS = 1000;
      const freezeVersion = freezeTimeS * 1000;
      vi.setSystemTime(new Date(1010 * 1000));

      configService.get.mockResolvedValue({
        version: 1,
        value: { freeze_time_s: freezeTimeS },
      });

      // Frozen pointer already matches freezeVersion
      scoreboardDataLoader.getPointers.mockResolvedValue({
        frozen: freezeVersion,
        latest: 1000 * 1000,
      });

      submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
      awardDAO.getAllAwards.mockResolvedValue([]);

      await service.computeAndSaveScoreboards(new Date(1010 * 1000));

      // Frozen snapshot should be touched via touchDivision, not recomputed via saveIndexed
      expect(scoreboardDataLoader.touchDivision).toHaveBeenCalledWith(1, {
        frozen: freezeVersion,
      });

      // saveIndexed should only be called once, for "latest"
      expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);
      expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledWith(
        1,
        1010 * 1000,
        expect.any(Array),
        expect.any(Map),
        "latest",
      );
    });

    it("expires superseded versions with a 10s grace period if not pointed to by any pointer", async () => {
      vi.setSystemTime(new Date(1000 * 1000));
      configService.get.mockResolvedValue({
        version: 1,
        value: {},
      });

      // Previous latest was version 500
      scoreboardDataLoader.getPointers.mockResolvedValue({ latest: 500 });
      submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
      awardDAO.getAllAwards.mockResolvedValue([]);

      await service.computeAndSaveScoreboards(new Date(1000 * 1000));

      // Superseded version 500 should be expired with 10s TTL
      expect(scoreboardDataLoader.expireVersions).toHaveBeenCalledWith(
        1,
        [500],
        10,
      );
    });

    it("does not expire superseded version early if still pointed to by another pointer", async () => {
      const freezeTimeS = 500;
      vi.setSystemTime(new Date(1000 * 1000));
      configService.get.mockResolvedValue({
        version: 1,
        value: { freeze_time_s: freezeTimeS },
      });

      // Both latest and frozen previously pointed to 500*1000
      // When latest advances to 1000*1000, frozen stays at 500*1000
      scoreboardDataLoader.getPointers.mockResolvedValue({
        frozen: 500 * 1000,
        latest: 500 * 1000,
      });
      submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
      awardDAO.getAllAwards.mockResolvedValue([]);

      await service.computeAndSaveScoreboards(new Date(1000 * 1000));

      // 500*1000 is still active for "frozen", so expireVersions should NOT be called with 500*1000
      expect(scoreboardDataLoader.expireVersions).not.toHaveBeenCalledWith(
        1,
        expect.arrayContaining([500 * 1000]),
        expect.any(Number),
      );
    });

    it("skips recalculating division and touches all active pointers when up to date", async () => {
      const freezeTimeS = 1000;
      vi.setSystemTime(new Date(1005 * 1000));
      configService.get.mockResolvedValue({
        version: 1,
        value: { freeze_time_s: freezeTimeS },
      });

      // Pointers are already up to date: latest is at 1005*1000, frozen is at 1000*1000
      scoreboardDataLoader.getPointers.mockResolvedValue({
        latest: 1005 * 1000,
        frozen: 1000 * 1000,
      });

      await service.computeAndSaveScoreboards(new Date(1005 * 1000));

      // Should touch the entire division (both pointers and both versions)
      expect(scoreboardDataLoader.touchDivision).toHaveBeenCalledWith(1, {
        latest: 1005 * 1000,
        frozen: 1000 * 1000,
      });

      // Should NOT query submissions/awards or save any scoreboards
      expect(submissionDAO.getSolvesForCalculation).not.toHaveBeenCalled();
      expect(scoreboardDataLoader.saveIndexed).not.toHaveBeenCalled();
    });

    it("does not skip division if freeze was changed retroactively", async () => {
      const newFreezeTimeS = 800; // Retroactive freeze set earlier
      vi.setSystemTime(new Date(1000 * 1000));
      configService.get.mockResolvedValue({
        version: 1,
        value: { freeze_time_s: newFreezeTimeS },
      });

      // Latest is up to date (1000*1000), but frozen pointer points to old freeze time (900*1000)
      scoreboardDataLoader.getPointers.mockResolvedValue({
        latest: 1000 * 1000,
        frozen: 900 * 1000,
      });
      submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
      awardDAO.getAllAwards.mockResolvedValue([]);

      await service.computeAndSaveScoreboards(new Date(1000 * 1000));

      // Division should NOT be skipped because frozen was not at target cutoff (800*1000)
      expect(submissionDAO.getSolvesForCalculation).toHaveBeenCalledWith(1);
      // Frozen should be recomputed at new target version 800*1000
      expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledWith(
        1,
        800 * 1000,
        expect.any(Array),
        expect.any(Map),
        "frozen",
      );
    });
  });
});
