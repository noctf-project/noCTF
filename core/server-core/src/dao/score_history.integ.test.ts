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
});
