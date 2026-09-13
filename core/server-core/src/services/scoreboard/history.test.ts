import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";
import { ScoreboardHistory } from "./history.ts";
import type { DatabaseClient, DBType } from "../../clients/database.ts";
import type { RedisClientFactory } from "../../clients/redis.ts";
import { ScoreHistoryDAO } from "../../dao/score_history.ts";
import type { createClient } from "redis";
import type { ScoreboardEntry } from "@noctf/api/datatypes";
import { encode } from "cbor-x";

vi.mock(import("../../dao/score_history.ts"));

describe(ScoreboardHistory, () => {
  const databaseClient = mock<DatabaseClient>();
  const redisClientFactory = mock<RedisClientFactory>();
  const redisClient = mock<ReturnType<typeof createClient>>();
  const scoreHistoryDAO = mockDeep<ScoreHistoryDAO>();

  beforeEach(() => {
    vi.mocked(ScoreHistoryDAO).mockReturnValue(scoreHistoryDAO);
    redisClientFactory.getClient.mockResolvedValue(redisClient);
    const multiMock = {
      set: vi.fn().mockReturnThis(),
      del: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      hSet: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    };
    redisClient.multi.mockReturnValue(
      multiMock as unknown as ReturnType<typeof redisClient.multi>,
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("filters out deleted/missing teams when saving iterations", async () => {
    const history = new ScoreboardHistory({
      databaseClient,
      redisClientFactory,
    });

    // Mock getLastData to return historical points for team 1 and team 2 (which was deleted)
    scoreHistoryDAO.listMostRecentByDivision.mockResolvedValue([
      { team_id: 1, score: 100, updated_at: new Date(1000) },
      { team_id: 2, score: 200, updated_at: new Date(1000) },
    ]);
    redisClient.get.mockResolvedValue(null);

    // Current scoreboard only contains team 1 (with new score 150). Team 2 was deleted.
    const currentScoreboard: ScoreboardEntry[] = [
      {
        team_id: 1,
        score: 150,
        rank: 1,
        last_solve: new Date(2000),
        updated_at: new Date(2000),
        hidden: false,
        tag_ids: [],
        awards: [],
        solves: [],
      },
    ];

    await history.saveIteration(1, currentScoreboard);

    // Assert that scoreHistoryDAO.add was called ONLY with team 1, and NOT team 2
    expect(scoreHistoryDAO.add).toHaveBeenCalledTimes(1);
    expect(scoreHistoryDAO.add).toHaveBeenCalledWith([
      {
        team_id: 1,
        score: 150,
      },
    ]);
  });

  it("filters out hidden teams when saving iterations", async () => {
    const history = new ScoreboardHistory({
      databaseClient,
      redisClientFactory,
    });

    scoreHistoryDAO.listMostRecentByDivision.mockResolvedValue([
      { team_id: 1, score: 100, updated_at: new Date(1000) },
      { team_id: 2, score: 100, updated_at: new Date(1000) },
    ]);
    redisClient.get.mockResolvedValue(null);

    const currentScoreboard: ScoreboardEntry[] = [
      {
        team_id: 1,
        score: 150,
        rank: 1,
        last_solve: new Date(2000),
        updated_at: new Date(2000),
        hidden: false,
        tag_ids: [],
        awards: [],
        solves: [],
      },
      {
        team_id: 2,
        score: 250,
        rank: 2,
        last_solve: new Date(2000),
        updated_at: new Date(2000),
        hidden: true, // hidden team
        tag_ids: [],
        awards: [],
        solves: [],
      },
    ];

    await history.saveIteration(1, currentScoreboard);

    expect(scoreHistoryDAO.add).toHaveBeenCalledTimes(1);
    expect(scoreHistoryDAO.add).toHaveBeenCalledWith([
      {
        team_id: 1,
        score: 150,
      },
    ]);
  });

  it("replaceAll flushes and re-adds data in a transaction and invalidates caches", async () => {
    const history = new ScoreboardHistory({
      databaseClient,
      redisClientFactory,
    });

    const txMock = mock<DBType>();
    databaseClient.transaction.mockImplementation(async (cb) => {
      return await cb(
        txMock as unknown as Parameters<
          Parameters<typeof databaseClient.transaction>[0]
        >[0],
      );
    });

    const samplePoints = [
      { team_id: 1, score: 100, updated_at: new Date(1000) },
      { team_id: 2, score: 200, updated_at: new Date(1000) },
    ];

    await history.replaceAll(samplePoints, [1, 2]);

    expect(databaseClient.transaction).toHaveBeenCalledTimes(1);
    expect(scoreHistoryDAO.flushAll).toHaveBeenCalledTimes(1);
    expect(scoreHistoryDAO.add).toHaveBeenCalledWith(samplePoints);

    const multi = redisClient.multi();
    expect(multi.del).toHaveBeenCalledWith("core:svc:score:history:data");
    expect(multi.del).toHaveBeenCalledWith("core:svc:score:history:calc:1");
    expect(multi.del).toHaveBeenCalledWith("core:svc:score:history:calc:2");
    expect(multi.exec).toHaveBeenCalled();
  });

  describe("getHistoryForTeams", () => {
    it("returns empty map if no teams provided", async () => {
      const history = new ScoreboardHistory({
        databaseClient,
        redisClientFactory,
      });
      const res = await history.getHistoryForTeams([]);
      expect(res.size).toBe(0);
    });

    it("returns cached data from Redis when present", async () => {
      const history = new ScoreboardHistory({
        databaseClient,
        redisClientFactory,
      });

      const fakeBuffer = encode([[10], [100]]);
      redisClient.hmGet.mockResolvedValue([fakeBuffer] as unknown as string[]);

      const res = await history.getHistoryForTeams([1]);
      expect(redisClient.hmGet).toHaveBeenCalledTimes(1);
      expect(res.has(1)).toBe(true);
    });

    it("fetches missing teams from database and writes back to Redis", async () => {
      const history = new ScoreboardHistory({
        databaseClient,
        redisClientFactory,
      });

      // Cache miss in Redis
      redisClient.hmGet.mockResolvedValue([null] as unknown as string[]);

      // DB returns points sorted by team and updated_at
      scoreHistoryDAO.getByTeams.mockResolvedValue([
        { team_id: 1, score: 100, updated_at: new Date(10000) },
        { team_id: 1, score: 250, updated_at: new Date(20000) },
      ]);

      const res = await history.getHistoryForTeams([1]);
      expect(scoreHistoryDAO.getByTeams).toHaveBeenCalledWith([1]);
      expect(res.has(1)).toBe(true);

      const team1Points = res.get(1);
      expect(team1Points).toBeDefined();
      // Expect delta series [ [10, 10], [100, 150] ] (time delta in seconds, score delta)
      expect(team1Points![0]).toEqual([10, 10]); // 10000ms = 10s, 20000ms - 10000ms = 10s
      expect(team1Points![1]).toEqual([100, 150]); // 100 - 0 = 100, 250 - 100 = 150

      expect(redisClient.hSet).toHaveBeenCalled();
    });
  });
});
