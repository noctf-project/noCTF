import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SubmissionWeightDAO } from "./submission_weight.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";

describe(SubmissionWeightDAO, () => {
  let clients: TestClients;
  let dao: SubmissionWeightDAO;

  beforeAll(() => {
    clients = createTestClients();
    dao = new SubmissionWeightDAO(clients.getDb());
  });

  afterAll(async () => {
    await clients.destroy();
  });

  it("appends weight history and lists it per challenge and team", async () => {
    // One row per insert so each gets a distinct created_at
    await dao.create([{ challenge_id: 1, team_id: 1, weight: 10 }]);
    await dao.create([{ challenge_id: 1, team_id: 1, weight: 25 }]);
    await dao.create([{ challenge_id: 1, team_id: 2, weight: 40 }]);

    const all = await dao.listAll(1);
    expect(all.map((r) => r.weight)).toEqual([10, 25, 40]);

    const team1Weights = await dao.listAll(1, 1);
    expect(team1Weights.map((r) => r.weight)).toEqual([10, 25]);
    expect(team1Weights.every((r) => r.team_id === 1)).toBe(true);
    expect(team1Weights.every((r) => r.created_at instanceof Date)).toBe(true);

    const latest = await dao.listLatest(1);
    expect(latest).toHaveLength(2);
    expect(latest.find((r) => r.team_id === 1)?.weight).toBe(25);
    expect(latest.find((r) => r.team_id === 2)?.weight).toBe(40);
  });

  it("handles batch insert with unnest for multiple rows", async () => {
    const items = Array.from({ length: 250 }, (_, i) => ({
      challenge_id: 2,
      team_id: i + 1,
      weight: (i + 1) * 10,
    }));

    await dao.create(items);

    const latest = await dao.listLatest(2);
    expect(latest).toHaveLength(250);
    expect(latest.find((r) => r.team_id === 10)?.weight).toBe(100);
    expect(latest.find((r) => r.team_id === 250)?.weight).toBe(2500);
  });
});
