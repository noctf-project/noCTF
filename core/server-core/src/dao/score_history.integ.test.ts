import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ScoreHistoryDAO } from "./score_history.ts";
import { TeamDAO } from "./team.ts";
import { DivisionDAO } from "./division.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";

describe(ScoreHistoryDAO, () => {
  let clients: TestClients;
  let dao: ScoreHistoryDAO;
  let teamDAO: TeamDAO;
  let divisionDAO: DivisionDAO;

  beforeAll(() => {
    clients = createTestClients();
    dao = new ScoreHistoryDAO(clients.getDb());
    teamDAO = new TeamDAO(clients.getDb());
    divisionDAO = new DivisionDAO(clients.getDb());
  });

  afterAll(async () => {
    await clients.destroy();
  });

  it("records, queries, and flushes score history", async () => {
    const div = await divisionDAO.create({
      name: "Score History Div",
      slug: "score-history-div",
      description: "Division for score history",
      is_joinable: true,
      is_visible: true,
    });

    const team = await teamDAO.create({
      name: "Scoring Team",
      division_id: div.id,
    });

    const now = new Date();
    await dao.add([
      { team_id: team.id, score: 100, updated_at: now },
      {
        team_id: team.id,
        score: 250,
        updated_at: new Date(now.getTime() + 1000),
      },
    ]);

    const teamScores = await dao.getByTeams([team.id]);
    expect(teamScores.length).toBeGreaterThanOrEqual(2);

    const recent = await dao.listMostRecentByDivision(div.id);
    expect(recent).toHaveLength(1);
    expect(recent[0].score).toBe(250);

    await dao.flushTeam(team.id);
    const afterFlush = await dao.getByTeams([team.id]);
    expect(afterFlush).toHaveLength(0);
  });

  it("handles batch upsert with default timestamps, on-conflict updates, and hundreds of entries", async () => {
    const teamCount = 300;
    const baseTeamId = 10000;
    const teamIds = Array.from({ length: teamCount }, (_, i) => baseTeamId + i);

    // 1. Insert hundreds of entries without explicit updated_at (tests default timestamp & unnest arrays)
    await dao.add(teamIds.map((id, idx) => ({ team_id: id, score: idx * 10 })));

    const scores = await dao.getByTeams(teamIds);
    expect(scores).toHaveLength(teamCount);

    // 2. Test ON CONFLICT DO UPDATE: upsert with identical (team_id, updated_at)
    const fixedTime = new Date("2026-01-01T00:00:00Z");
    const testIds = teamIds.slice(0, 10);
    await dao.add(
      testIds.map((id) => ({
        team_id: id,
        score: 50,
        updated_at: fixedTime,
      })),
    );

    // Upsert same timestamps with new score
    await dao.add(
      testIds.map((id) => ({
        team_id: id,
        score: 999,
        updated_at: fixedTime,
      })),
    );

    const updatedScores = await dao.getByTeams(testIds, fixedTime, fixedTime);
    expect(updatedScores).toHaveLength(10);
    for (const entry of updatedScores) {
      expect(entry.score).toBe(999);
    }
  });
});
