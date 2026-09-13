import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SubmissionDAO } from "./submission.ts";
import { TeamDAO } from "./team.ts";
import { UserDAO } from "./user.ts";
import { ChallengeDAO } from "./challenge.ts";
import { DivisionDAO } from "./division.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";

describe(SubmissionDAO, () => {
  let clients: TestClients;
  let dao: SubmissionDAO;
  let teamDAO: TeamDAO;
  let userDAO: UserDAO;
  let challengeDAO: ChallengeDAO;
  let divisionDAO: DivisionDAO;

  beforeAll(() => {
    clients = createTestClients();
    dao = new SubmissionDAO(clients.getDb());
    teamDAO = new TeamDAO(clients.getDb());
    userDAO = new UserDAO(clients.getDb());
    challengeDAO = new ChallengeDAO(clients.getDb());
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
    const user = await userDAO.create({ name: "sub_user" });

    const chal = await challengeDAO.create({
      title: "Misc 1",
      slug: "misc-1",
      description: "Easy misc",
      tags: { category: "misc" },
      hidden: false,
      visible_at: null,
      private_metadata: {
        solve: { source: "flag" },
        score: { strategy: "core:static", params: { base: 100 } },
        files: [],
      },
    });

    // Team 1 first blood
    const sub1 = await dao.create({
      challenge_id: chal.id,
      team_id: team1.id,
      user_id: user,
      source: "flag",
      status: "correct",
      value: 100,
      hidden: false,
      data: "flag{first}",
    });
    expect(sub1.id).toBeDefined();
    expect(sub1.seq).toBe(0);

    // Team 2 second blood
    const sub2 = await dao.create({
      challenge_id: chal.id,
      team_id: team2.id,
      user_id: user,
      source: "flag",
      status: "correct",
      value: 100,
      hidden: false,
      data: "flag{second}",
    });
    expect(sub2.seq).toBe(1);

    // Check metadata
    const meta = await dao.getCurrentMetadata(chal.id, team1.id);
    expect(meta?.status).toBe("correct");

    // Check solves for calculation
    const solves = await dao.getSolvesForCalculation(div.id);
    expect(solves).toHaveLength(2);
    expect(solves[0].team_id).toBe(team1.id);

    // Check stats
    const stats = await dao.listStats({
      division_id: div.id,
      challenge_ids: [chal.id],
    });
    expect(stats).toHaveLength(1);
    expect(stats[0].correct_count).toBe(2);
    expect(stats[0].first_solve_team_id).toBe(team1.id);

    // Update submissions (e.g. adjust value or weight)
    const updated = await dao.updateSubmissions([
      { id: sub1.id, weight: 10 },
      { id: sub2.id, weight: 10 },
    ]);
    expect(updated).toHaveLength(2);

    const weights = await dao.listWeights({ challenge_id: [chal.id] });
    expect(weights).toHaveLength(2);
    expect(weights.every((w) => w.weight === 10)).toBe(true);
  });
});
