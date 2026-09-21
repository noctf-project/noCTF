import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SubmissionDAO } from "./submission.ts";
import { TeamDAO } from "./team.ts";
import { DivisionDAO } from "./division.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";

describe(SubmissionDAO, () => {
  let clients: TestClients;
  let db: ReturnType<TestClients["getDb"]>;
  let dao: SubmissionDAO;
  let teamDAO: TeamDAO;
  let divisionDAO: DivisionDAO;

  beforeAll(() => {
    clients = createTestClients();
    db = clients.getDb();
    dao = new SubmissionDAO(db);
    teamDAO = new TeamDAO(db);
    divisionDAO = new DivisionDAO(db);
  });

  afterAll(async () => {
    await clients.destroy();
  });

  it("creates submissions, calculates sequence, queries solves and stats", async () => {
    const div = await divisionDAO.create({
      name: "Sub Div",
      slug: "sub-div",
      description: "Division for submissions",
      is_joinable: true,
      is_visible: true,
    });

    const team1 = await teamDAO.create({
      name: "Sub Team 1",
      division_id: div.id,
    });
    const team2 = await teamDAO.create({
      name: "Sub Team 2",
      division_id: div.id,
    });

    // Team 1 first blood
    const sub = await dao.create([
      {
        challenge_id: 1,
        team_id: team1.id,
        user_id: 1,
        source: "flag",
        status: "correct",
        value: 100,
        hidden: false,
        data: "flag{first}",
      },
      {
        challenge_id: 1,
        team_id: team2.id,
        user_id: 2,
        source: "flag",
        status: "correct",
        value: 100,
        hidden: false,
        data: "flag{second}",
      },
    ]);
    expect(sub[0].id).toBeTruthy();
    expect(sub[1].id).toBeTruthy();

    // Check metadata
    const meta = await dao.listTeamView(team1.id, 1);
    expect(meta[0].status).toBe("correct");

    // Check solves for calculation
    const solves = await dao.getSolvesForCalculation(div.id);
    expect(solves).toHaveLength(2);
    expect(solves[0].team_id).toBe(team1.id);

    // Check stats
    const stats = await dao.listStats({
      division_id: div.id,
      challenge_ids: [1],
    });
    expect(stats).toHaveLength(1);
    expect(stats[0].correct_count).toBe(2);
    expect(stats[0].first_solve_team_id).toBe(team1.id);

    // Update submissions (e.g. adjust value)
    const updated = await dao.updateSubmissions([{ id: sub[0].id, value: 10 }]);
    expect(updated).toHaveLength(1);
  });

  it("handles batch create with UNNEST, skipIfExists on conflict, and batch updateSubmissions", async () => {
    // Batch create via UNNEST (tables have no FK constraints on team_id/challenge_id)
    const items = Array.from({ length: 50 }, (_, idx) => ({
      challenge_id: 10,
      team_id: 5000 + idx,
      source: "batch",
      status: "correct" as const,
      data: `flag{${idx}}`,
      value: 100,
    }));

    const created = await dao.create(items);
    expect(created).toHaveLength(50);

    // Test skipIfExists: inserting same challenge_id + team_id with status=correct should do nothing
    const dupes = await dao.create(items, true);
    expect(dupes).toHaveLength(0);

    // Test batch updateSubmissions with UNNEST
    const updates = created.slice(0, 20).map((c, i) => ({
      id: c.id,
      value: 500 + i,
      hidden: true,
    }));

    const updated = await dao.updateSubmissions(updates);
    expect(updated).toHaveLength(20);
    expect(updated.every((u) => u.hidden === true)).toBe(true);
  });

  it("applies column defaults when optional fields are omitted in batch create", async () => {
    // Only pass mandatory fields, omit data, metadata, hidden
    const items = [
      {
        challenge_id: 20,
        team_id: 6001,
        source: "test",
        status: "correct" as const,
      },
      {
        challenge_id: 20,
        team_id: 6002,
        source: "test",
        status: "incorrect" as const,
      },
    ];

    const created = await dao.create(items);
    expect(created).toHaveLength(2);

    const rows = await db
      .selectFrom("submission")
      .select(["id", "data", "source", "metadata", "hidden", "value"])
      .where(
        "id",
        "in",
        created.map((c) => c.id),
      )
      .execute();

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.data).toBe("");
      expect(row.source).toBe("test");
      expect(row.metadata).toEqual({});
      expect(row.hidden).toBe(false);
      expect(row.value).toBeNull();
    }
  });

  it("rejects batch insert and inserts nothing if a required field violates NOT NULL", async () => {
    const items = [
      {
        challenge_id: 30,
        team_id: 7001,
        source: "test",
        status: "correct" as const,
      },
      {
        challenge_id: 30,
        // team_id is NOT NULL in database
        team_id: null as unknown as number,
        source: "test",
        status: "correct" as const,
      },
    ];

    await expect(dao.create(items)).rejects.toThrow(/not-null|null value/i);

    // Verify atomic behavior: first item should not have been persisted
    const rows = await db
      .selectFrom("submission")
      .select(["id"])
      .where("challenge_id", "=", 30)
      .where("team_id", "=", 7001)
      .execute();
    expect(rows).toHaveLength(0);
  });

  it("rejects batch insert if an invalid enum value is supplied", async () => {
    const items = [
      {
        challenge_id: 40,
        team_id: 8001,
        source: "test",
        // Invalid enum string
        status: "not_a_valid_status" as unknown as "correct",
      },
      {
        challenge_id: 40,
        team_id: 8002,
        source: "test",
        status: "correct" as const,
      },
    ];

    await expect(dao.create(items)).rejects.toThrow(
      /invalid input value for enum/i,
    );

    // Verify nothing was persisted
    const rows = await db
      .selectFrom("submission")
      .select(["id"])
      .where("challenge_id", "=", 40)
      .execute();
    expect(rows).toHaveLength(0);
  });

  it("returns null when no activity exists and greatest timestamp across submission, weight, and award", async () => {
    // Clean up test rows from relevant tables
    await db.deleteFrom("submission").execute();
    await db.deleteFrom("submission_weight").execute();
    await db.deleteFrom("award").execute();

    // 1. Empty tables -> returns null
    const empty = await dao.getLatestActivityTimestamp();
    expect(empty).toBeNull();

    const div = await divisionDAO.create({
      name: "Watermark Div",
      slug: "wm-div",
      description: "Division for watermark tests",
      is_joinable: true,
      is_visible: true,
    });
    const team = await teamDAO.create({
      name: "Watermark Team",
      division_id: div.id,
    });

    // 2. Insert submission at T1 (1000s)
    const t1 = new Date(1000 * 1000);
    await db
      .insertInto("submission")
      .values({
        challenge_id: 100,
        team_id: team.id,
        user_id: 1,
        source: "test",
        status: "correct",
        data: "",
        created_at: t1,
        updated_at: t1,
      })
      .execute();

    let latest = await dao.getLatestActivityTimestamp();
    expect(latest?.getTime()).toBe(t1.getTime());

    // 3. Insert submission_weight at T2 (2000s) > T1
    const t2 = new Date(2000 * 1000);
    await db
      .insertInto("submission_weight")
      .values({
        challenge_id: 100,
        team_id: team.id,
        weight: 50,
        created_at: t2,
      })
      .execute();

    latest = await dao.getLatestActivityTimestamp();
    expect(latest?.getTime()).toBe(t2.getTime());

    // 4. Insert award at T3 (3000s) > T2
    const t3 = new Date(3000 * 1000);
    await db
      .insertInto("award")
      .values({
        team_id: team.id,
        value: 100,
        title: "First Blood",
        created_at: t3,
      })
      .execute();

    latest = await dao.getLatestActivityTimestamp();
    expect(latest?.getTime()).toBe(t3.getTime());
  });
});
