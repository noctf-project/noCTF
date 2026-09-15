import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SubmissionDAO } from "./submission.ts";
import { TeamDAO } from "./team.ts";
import { DivisionDAO } from "./division.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";

describe(SubmissionDAO, () => {
  let clients: TestClients;
  let dao: SubmissionDAO;
  let teamDAO: TeamDAO;
  let divisionDAO: DivisionDAO;

  beforeAll(() => {
    clients = createTestClients();
    dao = new SubmissionDAO(clients.getDb());
    teamDAO = new TeamDAO(clients.getDb());
    divisionDAO = new DivisionDAO(clients.getDb());
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
    const meta = await dao.getCurrentMetadata(1, team1.id);
    expect(meta?.status).toBe("correct");

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
});
