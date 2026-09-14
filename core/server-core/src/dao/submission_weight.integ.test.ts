import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SubmissionWeightDAO } from "./submission_weight.ts";
import { TeamDAO } from "./team.ts";
import { ChallengeDAO } from "./challenge.ts";
import { DivisionDAO } from "./division.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";

describe(SubmissionWeightDAO, () => {
  let clients: TestClients;
  let dao: SubmissionWeightDAO;
  let teamDAO: TeamDAO;
  let challengeDAO: ChallengeDAO;
  let divisionDAO: DivisionDAO;

  beforeAll(() => {
    clients = createTestClients();
    dao = new SubmissionWeightDAO(clients.getDb());
    teamDAO = new TeamDAO(clients.getDb());
    challengeDAO = new ChallengeDAO(clients.getDb());
    divisionDAO = new DivisionDAO(clients.getDb());
  });

  afterAll(async () => {
    await clients.destroy();
  });

  it("appends weight history and lists it per challenge and team", async () => {
    const div = await divisionDAO.create({
      name: "Weight Div",
      slug: "weight-div",
      description: "Division for submission weights",
      is_joinable: true,
      is_visible: true,
    });

    const team1 = await teamDAO.create({
      name: "Weight Team 1",
      division_id: div.id,
    });
    const team2 = await teamDAO.create({
      name: "Weight Team 2",
      division_id: div.id,
    });

    const chal = await challengeDAO.create({
      title: "KOTH 1",
      slug: "koth-1",
      description: "King of the hill",
      tags: { category: "koth" },
      hidden: false,
      visible_at: null,
      private_metadata: {
        solve: { source: "weight" },
        score: {
          strategy: "core:bounded_weight",
          params: { lower: 0, upper: 100 },
        },
        files: [],
      },
    });

    // One row per insert so each gets a distinct created_at
    await dao.create([
      { challenge_id: chal.id, team_id: team1.id, weight: 10 },
    ]);
    await dao.create([
      { challenge_id: chal.id, team_id: team1.id, weight: 25 },
    ]);
    await dao.create([
      { challenge_id: chal.id, team_id: team2.id, weight: 40 },
    ]);

    const all = await dao.listByChallenge(chal.id);
    expect(all.map((r) => r.weight)).toEqual([10, 25, 40]);

    const team1Weights = await dao.listByChallenge(chal.id, team1.id);
    expect(team1Weights.map((r) => r.weight)).toEqual([10, 25]);
    expect(team1Weights.every((r) => r.team_id === team1.id)).toBe(true);
    expect(team1Weights.every((r) => r.created_at instanceof Date)).toBe(true);

    const latest = await dao.listLatestByChallenge(chal.id);
    expect(latest).toHaveLength(2);
    expect(latest.find((r) => r.team_id === team1.id)?.weight).toBe(25);
    expect(latest.find((r) => r.team_id === team2.id)?.weight).toBe(40);
  });
});
