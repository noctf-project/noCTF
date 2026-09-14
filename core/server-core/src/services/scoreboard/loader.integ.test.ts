import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ScoreboardDataLoader } from "./loader.ts";
import { createTestClients, TestClients } from "../../test/integ-clients.ts";
import { ScoreboardEntry, Solve } from "@noctf/api/datatypes";
import { ComputedChallengeScoreData } from "./calc.ts";

describe(ScoreboardDataLoader, () => {
  let clients: TestClients;
  let loader: ScoreboardDataLoader;

  beforeAll(() => {
    clients = createTestClients();
    loader = new ScoreboardDataLoader(clients.getRedisFactory());
  });

  afterAll(async () => {
    await clients.destroy();
  });

  it("saves, indexes, and queries scoreboard data in Redis", async () => {
    const divisionId = 9999;
    const version = 1000000;

    await loader.saveTeamTags([
      { id: 101, division_id: divisionId, tag_ids: [1, 2], flags: [] },
      { id: 102, division_id: divisionId, tag_ids: [2], flags: [] },
      { id: 103, division_id: divisionId, tag_ids: [3], flags: [] },
    ]);

    const sampleEntries: ScoreboardEntry[] = [
      {
        team_id: 101,
        tag_ids: [1, 2],
        score: 500,
        rank: 1,
        last_solve: new Date(1000),
        updated_at: new Date(1000),
        hidden: false,
        solves: [
          {
            user_id: 1,
            challenge_id: 10,
            value: 500,
            created_at: new Date(1000),
            hidden: false,
          },
        ],
        awards: [],
      },
      {
        team_id: 102,
        tag_ids: [2],
        score: 300,
        rank: 2,
        last_solve: new Date(900),
        updated_at: new Date(900),
        hidden: false,
        solves: [
          {
            user_id: 2,
            challenge_id: 10,
            value: 300,
            created_at: new Date(900),
            hidden: false,
          },
        ],
        awards: [],
      },
      {
        team_id: 103,
        tag_ids: [3],
        score: 100,
        rank: 3,
        last_solve: new Date(800),
        updated_at: new Date(800),
        hidden: false,
        solves: [],
        awards: [],
      },
      {
        team_id: 104,
        tag_ids: [],
        score: 0,
        rank: 4,
        last_solve: new Date(0),
        updated_at: new Date(0),
        hidden: true,
        solves: [],
        awards: [],
      },
    ];

    const challengeSolves: Solve[] = [
      {
        team_id: 101,
        user_id: 1,
        challenge_id: 10,
        value: 500,
        created_at: new Date(1000),
        hidden: false,
      },
      {
        team_id: 102,
        user_id: 2,
        challenge_id: 10,
        value: 300,
        created_at: new Date(900),
        hidden: false,
      },
    ];

    const challengesMap = new Map<number, ComputedChallengeScoreData>([
      [
        10,
        {
          challenge_id: 10,
          value: 300,
          solves: challengeSolves,
        },
      ],
    ]);

    const saved = await loader.saveIndexed(
      divisionId,
      version,
      sampleEntries,
      challengesMap,
      "latest",
    );
    expect(saved).toEqual({ division_id: divisionId, version });

    const pointers = await loader.getPointers(divisionId, [
      "latest",
      "nonexistent",
    ]);
    expect(pointers.latest).toBe(version);
    expect(pointers.nonexistent).toBeUndefined();

    const scoreboard = await loader.getScoreboard(divisionId, version, 0, 10);
    expect(scoreboard.total).toBe(3);
    expect(scoreboard.entries).toHaveLength(3);
    expect(scoreboard.entries[0].team_id).toBe(101);
    expect(scoreboard.entries[0].score).toBe(500);
    expect(scoreboard.entries[1].team_id).toBe(102);
    expect(scoreboard.entries[2].team_id).toBe(103);

    const taggedScoreboard = await loader.getScoreboard(
      divisionId,
      version,
      0,
      10,
      [2],
    );
    expect(taggedScoreboard.total).toBe(2);
    expect(taggedScoreboard.entries.map((e) => e.team_id)).toEqual([101, 102]);

    const [totalRanked, allRanks] = await loader.getRanks(
      divisionId,
      version,
      0,
      10,
    );
    expect(totalRanked).toBe(3);
    expect(allRanks).toEqual([101, 102, 103]);

    const [taggedTotal, taggedRanks] = await loader.getRanks(
      divisionId,
      version,
      0,
      10,
      [3],
    );
    expect(taggedTotal).toBe(1);
    expect(taggedRanks).toEqual([103]);

    const team101 = await loader.getTeam(divisionId, version, 101);
    expect(team101?.team_id).toBe(101);
    expect(team101?.score).toBe(500);

    const nonExistentTeam = await loader.getTeam(divisionId, version, 9999);
    expect(nonExistentTeam).toBeNull();

    const rank101 = await loader.getTeamRank(divisionId, version, 101);
    expect(rank101).toBe(1);

    const rank102 = await loader.getTeamRank(divisionId, version, 102);
    expect(rank102).toBe(2);

    const taggedRank102 = await loader.getTeamRank(
      divisionId,
      version,
      102,
      [2],
    );
    expect(taggedRank102).toBe(2);

    const taggedRank103 = await loader.getTeamRank(
      divisionId,
      version,
      103,
      [2],
    );
    expect(taggedRank103).toBeNull();

    const summary = await loader.getChallengeSummary(divisionId, version);
    expect(summary[10]).toBeDefined();
    expect(summary[10].challenge_id).toBe(10);
    expect(summary[10].value).toBe(300);
    expect(summary[10].solve_count).toBe(2);

    const solves = await loader.getChallengeSolves(divisionId, version, 10);
    expect(solves).toHaveLength(2);
    expect(solves[0].team_id).toBe(101);
    expect(solves[1].team_id).toBe(102);

    await loader.touchDivision(divisionId, { latest: version });

    await loader.expireVersions(divisionId, [version], 1);
  });

  it("handles empty or zero version requests gracefully", async () => {
    const divisionId = 9998;

    expect(await loader.getScoreboard(divisionId, 0, 0, 10)).toEqual({
      total: 0,
      entries: [],
    });
    expect(await loader.getTeam(divisionId, 0, 101)).toBeNull();
    expect(await loader.getTeamRank(divisionId, 0, 101)).toBeNull();
    expect(await loader.getChallengeSummary(divisionId, 0)).toEqual({});
    expect(await loader.getChallengeSolves(divisionId, 0, 10)).toEqual([]);
    expect(await loader.getRanks(divisionId, 0, 0, 10)).toEqual([0, []]);
    expect(await loader.getPointers(divisionId, [])).toEqual({});
  });

  it("handles non-existent versions and missing keys gracefully", async () => {
    const divisionId = 9997;
    const nonExistentVersion = 99999999;

    const scoreboard = await loader.getScoreboard(
      divisionId,
      nonExistentVersion,
      0,
      10,
    );
    expect(scoreboard).toEqual({ total: 0, entries: [] });

    const taggedScoreboard = await loader.getScoreboard(
      divisionId,
      nonExistentVersion,
      0,
      10,
      [99],
    );
    expect(taggedScoreboard).toEqual({ total: 0, entries: [] });

    const team = await loader.getTeam(divisionId, nonExistentVersion, 1);
    expect(team).toBeNull();

    const rank = await loader.getTeamRank(divisionId, nonExistentVersion, 1);
    expect(rank).toBeNull();

    const taggedRank = await loader.getTeamRank(
      divisionId,
      nonExistentVersion,
      1,
      [99],
    );
    expect(taggedRank).toBeNull();

    const ranks = await loader.getRanks(divisionId, nonExistentVersion, 0, 10);
    expect(ranks).toEqual([0, []]);

    const taggedRanks = await loader.getRanks(
      divisionId,
      nonExistentVersion,
      0,
      10,
      [99],
    );
    expect(taggedRanks).toEqual([0, []]);

    const summary = await loader.getChallengeSummary(
      divisionId,
      nonExistentVersion,
    );
    expect(summary).toEqual({});

    const solves = await loader.getChallengeSolves(
      divisionId,
      nonExistentVersion,
      10,
    );
    expect(solves).toEqual([]);
  });

  it("handles pagination boundaries and out of range offsets", async () => {
    const divisionId = 9996;
    const version = 2000000;

    const sampleEntries: ScoreboardEntry[] = [
      {
        team_id: 201,
        tag_ids: [],
        score: 100,
        rank: 1,
        last_solve: new Date(100),
        updated_at: new Date(100),
        hidden: false,
        solves: [],
        awards: [],
      },
      {
        team_id: 202,
        tag_ids: [],
        score: 50,
        rank: 2,
        last_solve: new Date(50),
        updated_at: new Date(50),
        hidden: false,
        solves: [],
        awards: [],
      },
    ];

    await loader.saveIndexed(
      divisionId,
      version,
      sampleEntries,
      new Map(),
      "latest",
    );

    const firstPage = await loader.getScoreboard(divisionId, version, 0, 0);
    expect(firstPage.total).toBe(2);
    expect(firstPage.entries).toHaveLength(1);
    expect(firstPage.entries[0].team_id).toBe(201);

    const secondPage = await loader.getScoreboard(divisionId, version, 1, 1);
    expect(secondPage.total).toBe(2);
    expect(secondPage.entries).toHaveLength(1);
    expect(secondPage.entries[0].team_id).toBe(202);

    const outOfBounds = await loader.getScoreboard(divisionId, version, 10, 20);
    expect(outOfBounds.total).toBe(2);
    expect(outOfBounds.entries).toHaveLength(0);
  });

  it("handles multiple and overlapping tags with union filtering", async () => {
    const divisionId = 9995;
    const version = 3000000;

    await loader.saveTeamTags([
      { id: 301, division_id: divisionId, tag_ids: [10], flags: [] },
      { id: 302, division_id: divisionId, tag_ids: [20], flags: [] },
      { id: 303, division_id: divisionId, tag_ids: [10, 20], flags: [] },
      { id: 304, division_id: divisionId, tag_ids: [30], flags: [] },
    ]);

    const entries: ScoreboardEntry[] = [
      {
        team_id: 301,
        tag_ids: [10],
        score: 400,
        rank: 1,
        last_solve: new Date(1),
        updated_at: new Date(1),
        hidden: false,
        solves: [],
        awards: [],
      },
      {
        team_id: 302,
        tag_ids: [20],
        score: 300,
        rank: 2,
        last_solve: new Date(2),
        updated_at: new Date(2),
        hidden: false,
        solves: [],
        awards: [],
      },
      {
        team_id: 303,
        tag_ids: [10, 20],
        score: 200,
        rank: 3,
        last_solve: new Date(3),
        updated_at: new Date(3),
        hidden: false,
        solves: [],
        awards: [],
      },
      {
        team_id: 304,
        tag_ids: [30],
        score: 100,
        rank: 4,
        last_solve: new Date(4),
        updated_at: new Date(4),
        hidden: false,
        solves: [],
        awards: [],
      },
    ];

    await loader.saveIndexed(divisionId, version, entries, new Map(), "latest");

    const unionResult = await loader.getScoreboard(
      divisionId,
      version,
      0,
      10,
      [10, 20],
    );
    expect(unionResult.total).toBe(3);
    expect(unionResult.entries.map((e) => e.team_id)).toEqual([301, 302, 303]);

    const [rankedTotal, rankedTeams] = await loader.getRanks(
      divisionId,
      version,
      0,
      10,
      [10, 20],
    );
    expect(rankedTotal).toBe(3);
    expect(rankedTeams).toEqual([301, 302, 303]);

    const rank301 = await loader.getTeamRank(
      divisionId,
      version,
      301,
      [10, 20],
    );
    expect(rank301).toBe(1);

    const rank302 = await loader.getTeamRank(
      divisionId,
      version,
      302,
      [10, 20],
    );
    expect(rank302).toBe(2);

    const rank303 = await loader.getTeamRank(
      divisionId,
      version,
      303,
      [10, 20],
    );
    expect(rank303).toBe(3);

    const rank304 = await loader.getTeamRank(
      divisionId,
      version,
      304,
      [10, 20],
    );
    expect(rank304).toBeNull();
  });

  it("handles all-hidden teams and empty scoreboard snapshots", async () => {
    const divisionId = 9994;
    const version = 4000000;

    const allHidden: ScoreboardEntry[] = [
      {
        team_id: 401,
        tag_ids: [],
        score: 500,
        rank: 1,
        last_solve: new Date(1),
        updated_at: new Date(1),
        hidden: true,
        solves: [],
        awards: [],
      },
    ];

    await loader.saveIndexed(
      divisionId,
      version,
      allHidden,
      new Map(),
      "latest",
    );

    const scoreboard = await loader.getScoreboard(divisionId, version, 0, 10);
    expect(scoreboard.total).toBe(0);
    expect(scoreboard.entries).toHaveLength(0);

    const [totalRanked, ranks] = await loader.getRanks(
      divisionId,
      version,
      0,
      10,
    );
    expect(totalRanked).toBe(0);
    expect(ranks).toHaveLength(0);

    const team = await loader.getTeam(divisionId, version, 401);
    expect(team?.team_id).toBe(401);
    expect(team?.hidden).toBe(true);

    const rank = await loader.getTeamRank(divisionId, version, 401);
    expect(rank).toBeNull();
  });
});
