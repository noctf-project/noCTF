import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeepMockProxy, mockDeep } from "vitest-mock-extended";
import { decode, encode } from "cbor-x";
import type { ScoreboardEntry } from "@noctf/api/datatypes";
import { ScoreboardHistory } from "./history.ts";
import { ScoreHistoryDAO } from "../../dao/score_history.ts";
import { DatabaseClient } from "../../clients/database.ts";
import { RedisClientFactory } from "../../clients/redis.ts";
import { Compress, Decompress } from "../../util/message_compression.ts";

vi.mock(import("../../dao/score_history.ts"));

describe(ScoreboardHistory, () => {
  let dao: DeepMockProxy<ScoreHistoryDAO>;
  let client: DeepMockProxy<
    Awaited<ReturnType<RedisClientFactory["getClient"]>>
  >;
  let multi: DeepMockProxy<ReturnType<typeof client.multi>>;
  let history: ScoreboardHistory;

  const entry = (
    score: number,
    updated_at: Date,
    hidden = false,
  ): ScoreboardEntry => ({
    team_id: 5,
    score,
    updated_at,
    hidden,
    rank: 1,
    last_solve: updated_at,
    solves: [],
    awards: [],
    tag_ids: [],
  });

  beforeEach(() => {
    dao = mockDeep<ScoreHistoryDAO>();
    client = mockDeep<Awaited<ReturnType<RedisClientFactory["getClient"]>>>();
    multi = mockDeep<ReturnType<typeof client.multi>>();
    client.multi.mockReturnValue(multi);
    client.get.mockResolvedValue(null);
    dao.listMostRecentByDivision.mockResolvedValue([]);
    vi.mocked(ScoreHistoryDAO).mockImplementation(function () {
      return dao;
    });
    const databaseClient = mockDeep<DatabaseClient>();
    const redisClientFactory = mockDeep<RedisClientFactory>();
    redisClientFactory.getClient.mockResolvedValue(client);
    history = new ScoreboardHistory({ databaseClient, redisClientFactory });
  });

  afterEach(() => vi.resetAllMocks());

  it("persists the scoreboard timestamp, not the later processing time", async () => {
    const updated_at = new Date(120123);
    await history.saveIteration(1, [entry(100, updated_at)], []);

    expect(dao.add).toHaveBeenCalledWith([
      { team_id: 5, score: 100, updated_at },
    ]);
    const cached = multi.set.mock.calls[0][1] as Buffer;
    expect(decode(await Decompress(cached))).toEqual([
      { team_id: 5, score: 100, updated_at },
    ]);
    expect(multi.del).toHaveBeenCalledWith("core:svc:score:history:data");
  });

  it.each([100, 0])(
    "records deletion/hiding reducing a visible team's score to %i at the next publication",
    async (score) => {
      const earlier = { team_id: 5, score: 100, updated_at: new Date(100000) };
      const previous = { team_id: 5, score: 200, updated_at: new Date(120100) };
      const points = [earlier, previous];
      dao.listMostRecentByDivision.mockResolvedValue([previous]);
      dao.add.mockImplementation(async (entries) => {
        for (const point of entries) {
          expect(point.updated_at).toBeDefined();
          const existing = points.find(
            (p) =>
              p.team_id === point.team_id &&
              p.updated_at.getTime() === point.updated_at!.getTime(),
          );
          if (existing) existing.score = point.score;
          else points.push({ ...point, updated_at: point.updated_at! });
        }
      });
      const updated_at = new Date(120101);
      const current = entry(score, updated_at, score === 0);
      current.last_solve = earlier.updated_at;
      await history.saveIteration(1, [current], []);

      expect(dao.add).toHaveBeenCalledWith([{ team_id: 5, score, updated_at }]);
      expect(points).toEqual([
        { team_id: 5, score: 100, updated_at: new Date(100000) },
        { team_id: 5, score: 200, updated_at: new Date(120100) },
        { team_id: 5, score, updated_at },
      ]);
    },
  );

  it("records the initial point when a hidden team becomes visible with an unchanged score", async () => {
    const updated_at = new Date(120123);
    await history.saveIteration(1, [entry(100, updated_at, true)], [5]);
    expect(dao.add).toHaveBeenLastCalledWith([]);
    const cached = multi.set.mock.calls[0][1] as Buffer;
    expect(decode(await Decompress(cached))).toEqual([]);
    // Redis's default overload is string, but history requests returnBuffers.
    client.get.mockResolvedValue(cached as unknown as string);

    await history.saveIteration(1, [entry(100, updated_at)], []);
    expect(dao.add).toHaveBeenLastCalledWith([
      { team_id: 5, score: 100, updated_at },
    ]);
  });

  it("does not write zero points for hidden or removed teams", async () => {
    dao.listMostRecentByDivision.mockResolvedValue([
      { team_id: 5, score: 100, updated_at: new Date(100000) },
      { team_id: 6, score: 200, updated_at: new Date(100000) },
    ]);
    await history.saveIteration(1, [entry(100, new Date(120000), true)], [5]);
    expect(dao.add).toHaveBeenCalledWith([]);
  });

  it("excludes explicitly hidden teams even when awards give them a positive score", async () => {
    const updated_at = new Date(120100);
    const current = entry(100, updated_at, true);
    current.awards = [
      { id: 1, title: "Bonus", value: 100, created_at: updated_at },
    ];

    await history.saveIteration(1, [current], [5]);

    expect(dao.add).toHaveBeenCalledWith([]);
    expect(
      decode(await Decompress(multi.set.mock.calls[0][1] as Buffer)),
    ).toEqual([]);
  });

  it("does not write unchanged visible scores from the cached baseline", async () => {
    client.get.mockResolvedValue(
      Buffer.from(
        await Compress(
          encode([{ team_id: 5, score: 100, updated_at: new Date(100000) }]),
        ),
      ) as unknown as string,
    );
    await history.saveIteration(1, [entry(100, new Date(120000))], []);
    expect(dao.listMostRecentByDivision).not.toHaveBeenCalled();
    expect(dao.add).toHaveBeenCalledWith([]);
  });

  it("forces a frozen cutoff endpoint despite an identical later baseline, excluding explicitly hidden teams", async () => {
    const cutoff = new Date(120100);
    client.get.mockResolvedValue(
      Buffer.from(
        await Compress(
          encode([{ team_id: 5, score: 100, updated_at: new Date(120200) }]),
        ),
      ) as unknown as string,
    );
    const scoreboard = [
      entry(100, cutoff),
      { ...entry(200, cutoff, true), team_id: 6 },
    ];

    await history.saveIteration(1, scoreboard, [6], true);

    expect(dao.add).toHaveBeenCalledExactlyOnceWith([
      { team_id: 5, score: 100, updated_at: cutoff },
    ]);
    expect(
      decode(await Decompress(multi.set.mock.calls[0][1] as Buffer)),
    ).toEqual([{ team_id: 5, score: 100, updated_at: cutoff }]);
    expect(multi.del).toHaveBeenCalledWith("core:svc:score:history:data");
  });

  it("coalesces subsecond points while preserving cumulative time and score deltas", async () => {
    client.hmGet.mockResolvedValue(["", ""]);
    dao.getByTeams.mockResolvedValue([
      { team_id: 5, score: 100, updated_at: new Date(100100) },
      { team_id: 5, score: 200, updated_at: new Date(100200) },
      { team_id: 5, score: 250, updated_at: new Date(120100) },
      { team_id: 5, score: 175, updated_at: new Date(120200) },
      { team_id: 5, score: 300, updated_at: new Date(140000) },
      { team_id: 6, score: 50, updated_at: new Date(120000) },
    ]);

    expect(await history.getHistoryForTeams([5, 6])).toEqual(
      new Map([
        [
          5,
          [
            [100, 20, 20],
            [200, -25, 125],
          ],
        ],
        [6, [[120], [50]]],
      ]),
    );
  });

  it("applies SQL cutoffs before aggregation and caches each precise cutoff separately", async () => {
    const points = [
      { team_id: 5, score: 100, updated_at: new Date(120100) },
      { team_id: 5, score: 200, updated_at: new Date(120200) },
    ];
    client.hmGet.mockResolvedValue([""]);
    dao.getByTeams.mockImplementation(async (_teams, _start, end) =>
      points.filter((p) => !end || p.updated_at <= end),
    );

    expect(
      (await history.getHistoryForTeams([5], new Date(120100))).get(5),
    ).toEqual([[120], [100]]);
    expect(
      (await history.getHistoryForTeams([5], new Date(120200))).get(5),
    ).toEqual([[120], [200]]);
    expect((await history.getHistoryForTeams([5])).get(5)).toEqual([
      [120],
      [200],
    ]);
    expect(dao.getByTeams.mock.calls).toEqual([
      [[5], undefined, new Date(120100)],
      [[5], undefined, new Date(120200)],
      [[5], undefined, undefined],
    ]);
    expect(client.hmGet.mock.calls.map((call) => call[2])).toEqual([
      ["5:120100"],
      ["5:120200"],
      ["5:all"],
    ]);
    expect(
      multi.hSet.mock.calls.map(
        (call) => (call[1] as [string, Buffer][])[0][0],
      ),
    ).toEqual(["5:120100", "5:120200", "5:all"]);

    client.hmGet.mockResolvedValue([
      encode([[120], [100]]) as unknown as string,
    ]);
    expect(
      (await history.getHistoryForTeams([5], new Date(120100))).get(5),
    ).toEqual([[120], [100]]);
    expect(dao.getByTeams).toHaveBeenCalledTimes(3);
  });

  it("coalesces requests only when both team and precise cutoff match", async () => {
    client.hmGet.mockResolvedValue([""]);
    const started = Promise.withResolvers<void>();
    const pending =
      Promise.withResolvers<
        Awaited<ReturnType<ScoreHistoryDAO["getByTeams"]>>
      >();
    dao.getByTeams
      .mockImplementationOnce(() => {
        started.resolve();
        return pending.promise;
      })
      .mockResolvedValue([
        { team_id: 5, score: 200, updated_at: new Date(120200) },
      ]);
    const first = history.getHistoryForTeams([5], new Date(120100));
    await started.promise;
    const same = history.getHistoryForTeams([5], new Date(120100));
    const later = await history.getHistoryForTeams([5], new Date(120200));
    expect(later.get(5)).toEqual([[120], [200]]);
    expect(dao.getByTeams).toHaveBeenCalledTimes(2);

    pending.resolve([{ team_id: 5, score: 100, updated_at: new Date(120100) }]);
    expect((await first).get(5)).toEqual([[120], [100]]);
    expect(await same).toEqual(await first);
    expect(dao.getByTeams).toHaveBeenCalledTimes(2);
  });
});
