import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScoreboardService } from "./index.ts";
import { DeepMockProxy, mockDeep } from "vitest-mock-extended";
import { ScoreboardDataLoader } from "./loader.ts";
import { ScoreboardHistory } from "./history.ts";
import { ConfigService } from "../config.ts";
import { DatabaseClient } from "../../clients/database.ts";
import { RedisClientFactory } from "../../clients/redis.ts";

vi.mock(import("./loader.ts"));
vi.mock(import("./history.ts"));

describe(ScoreboardService, () => {
  let configService: DeepMockProxy<ConfigService>;
  let databaseClient: DeepMockProxy<DatabaseClient>;
  let redisClientFactory: DeepMockProxy<RedisClientFactory>;

  let scoreboardDataLoader: DeepMockProxy<ScoreboardDataLoader>;
  let scoreboardHistory: DeepMockProxy<ScoreboardHistory>;

  let service: ScoreboardService;

  beforeEach(() => {
    configService = mockDeep<ConfigService>();
    databaseClient = mockDeep<DatabaseClient>();
    redisClientFactory = mockDeep<RedisClientFactory>();

    scoreboardDataLoader = mockDeep<ScoreboardDataLoader>();
    scoreboardHistory = mockDeep<ScoreboardHistory>();

    vi.mocked(ScoreboardDataLoader).mockImplementation(function () {
      return scoreboardDataLoader;
    });
    vi.mocked(ScoreboardHistory).mockImplementation(function () {
      return scoreboardHistory;
    });

    service = new ScoreboardService({
      configService,
      databaseClient,
      redisClientFactory,
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
      expect(scoreboardHistory.getHistoryForTeams).toHaveBeenCalledWith(
        [5],
        undefined,
      );
      expect(result.get(5)).toEqual([
        [100, 20],
        [100, 500],
      ]);
    });

    it.each([
      { start: 110, end: 115, expected: [[], []] },
      { start: undefined, end: 99, expected: [[], []] },
      { start: 141, end: undefined, expected: [[], []] },
      { start: 120, end: 119, expected: [[], []] },
      { start: 110, end: 120, expected: [[120], [600]] },
      {
        start: 120,
        end: 140,
        expected: [
          [120, 20],
          [600, -50],
        ],
      },
    ])(
      "filters history within inclusive bounds $start to $end",
      async ({ start, end, expected }) => {
        configService.get.mockResolvedValue({
          version: 1,
          value: { start_time_s: start, end_time_s: end },
        });
        const graph: [number[], number[]] = [
          [100, 20, 20],
          [100, 500, -50],
        ];
        scoreboardHistory.getHistoryForTeams.mockResolvedValue(
          new Map([[5, graph]]),
        );

        expect((await service.getTeamScoreHistory([5])).get(5)).toEqual(
          expected,
        );
        expect(scoreboardHistory.getHistoryForTeams).toHaveBeenCalledWith(
          [5],
          end === undefined ? undefined : new Date(end * 1000 + 999),
        );
        expect(graph).toEqual([
          [100, 20, 20],
          [100, 500, -50],
        ]);
      },
    );

    it("uses the entry timestamp rather than competition end for explicit history cutoffs", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: { start_time_s: 100, end_time_s: 110 },
      });
      scoreboardHistory.getHistoryForTeams.mockResolvedValue(
        new Map([
          [
            5,
            [
              [100, 20, 20],
              [100, 500, -50],
            ],
          ],
        ]),
      );

      expect(
        (await service.getTeamScoreHistory([5], new Date(120100))).get(5),
      ).toEqual([
        [100, 20],
        [100, 500],
      ]);
      expect(scoreboardHistory.getHistoryForTeams).toHaveBeenCalledWith(
        [5],
        new Date(120100),
      );
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
});
