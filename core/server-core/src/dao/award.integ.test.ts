import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AwardDAO } from "./award.ts";
import { TeamDAO } from "./team.ts";
import { DivisionDAO } from "./division.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";

describe(AwardDAO, () => {
  let clients: TestClients;
  let dao: AwardDAO;
  let teamDAO: TeamDAO;
  let divisionDAO: DivisionDAO;

  beforeAll(() => {
    clients = createTestClients();
    dao = new AwardDAO(clients.getDb());
    teamDAO = new TeamDAO(clients.getDb());
    divisionDAO = new DivisionDAO(clients.getDb());
  });

  afterAll(async () => {
    await clients.destroy();
  });

  it("queries team awards and division awards", async () => {
    const div = await divisionDAO.create({
      name: "Award Div",
      slug: "award-div",
      description: "Division for awards",
      is_joinable: true,
      is_visible: true,
    });

    const team = await teamDAO.create({
      name: "Winners Team",
      division_id: div.id,
    });

    // Insert an award directly via DB
    await clients
      .getDb()
      .insertInto("award")
      .values({
        team_id: team.id,
        title: "First Blood Bonus",
        value: 100,
      })
      .execute();

    const teamAwards = await dao.getTeamAwards(team.id);
    expect(teamAwards).toHaveLength(1);
    expect(teamAwards[0].title).toBe("First Blood Bonus");
    expect(teamAwards[0].value).toBe(100);

    const allAwards = await dao.getAllAwards(div.id);
    expect(allAwards).toHaveLength(1);
    expect(allAwards[0].team_id).toBe(team.id);
  });
});
