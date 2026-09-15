import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TeamDAO } from "./team.ts";
import { DivisionDAO } from "./division.ts";
import { UserDAO } from "./user.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";
import { ConflictError, NotFoundError, BadRequestError } from "../errors.ts";

describe(TeamDAO, () => {
  let clients: TestClients;
  let teamDAO: TeamDAO;
  let divisionDAO: DivisionDAO;
  let userDAO: UserDAO;

  beforeAll(() => {
    clients = createTestClients();
    teamDAO = new TeamDAO(clients.getDb());
    divisionDAO = new DivisionDAO(clients.getDb());
    userDAO = new UserDAO(clients.getDb());
  });

  afterAll(async () => {
    await clients.destroy();
  });

  it("creates, retrieves, updates, and deletes teams", async () => {
    const division = await divisionDAO.create({
      name: "Team Test Division",
      slug: "team-test-div",
      description: "Division for team tests",
      is_joinable: true,
      is_visible: true,
    });

    const team = await teamDAO.create({
      name: "Cyber Knights",
      bio: "Top hackers",
      division_id: division.id,
      join_code: "join1234",
      flags: ["verified"],
    });

    expect(team.id).toBeDefined();
    expect(team.name).toBe("Cyber Knights");
    expect(team.division_id).toBe(division.id);
    expect(team.updated_at).toBeInstanceOf(Date);
    expect(team.created_at).toEqual(team.updated_at);

    const fetched = await teamDAO.get(team.id);
    expect(fetched.name).toBe("Cyber Knights");
    expect(fetched.bio).toBe("Top hackers");
    expect(fetched.division_id).toBe(division.id);

    const foundByCode = await teamDAO.findUsingJoinCode("join1234");
    expect(foundByCode.id).toBe(team.id);

    const updatedResult = await teamDAO.update(team.id, {
      bio: "Updated Bio",
      flags: ["verified", "hidden"],
    });
    expect(updatedResult.division_id).toBe(division.id);
    expect(updatedResult.flags).toEqual(["verified", "hidden"]);
    expect(updatedResult.updated_at).toBeInstanceOf(Date);
    expect(updatedResult.updated_at.getTime()).toBeGreaterThanOrEqual(
      team.updated_at.getTime(),
    );

    const updated = await teamDAO.get(team.id);
    expect(updated.bio).toBe("Updated Bio");

    const deleted = await teamDAO.delete(team.id);
    expect(deleted.id).toBe(team.id);
    expect(deleted.division_id).toBe(division.id);
    expect(deleted.flags).toEqual(["verified", "hidden"]);
    expect(deleted.updated_at).toBeInstanceOf(Date);
    await expect(teamDAO.get(team.id)).rejects.toThrow(NotFoundError);
  });

  it("handles duplicate team names and invalid division fkey", async () => {
    const division = await divisionDAO.create({
      name: "Constraint Div",
      slug: "constraint-div",
      description: "Constraint test division",
      is_joinable: true,
      is_visible: true,
    });

    await teamDAO.create({
      name: "Unique Team",
      division_id: division.id,
    });

    await expect(
      teamDAO.create({
        name: "Unique Team",
        division_id: division.id,
      }),
    ).rejects.toThrow(ConflictError);

    await expect(
      teamDAO.create({
        name: "Invalid Div Team",
        division_id: 999999,
      }),
    ).rejects.toThrow(BadRequestError);
  });

  it("assigns and unassigns members to a team", async () => {
    const division = await divisionDAO.create({
      name: "Member Div",
      slug: "member-div",
      description: "Member test division",
      is_joinable: true,
      is_visible: true,
    });

    const team = await teamDAO.create({
      name: "Fellowship",
      division_id: division.id,
    });

    const userId1 = await userDAO.create({
      name: "frodo",
    });
    const userId2 = await userDAO.create({
      name: "sam",
    });

    await teamDAO.assign({
      user_id: userId1,
      team_id: team.id,
      role: "owner",
    });

    await teamDAO.assign({
      user_id: userId2,
      team_id: team.id,
      role: "member",
    });

    const teamWithMembers = await teamDAO.get(team.id);
    expect(teamWithMembers.members).toHaveLength(2);
    expect(
      teamWithMembers.members.some(
        (m) => m.user_id === userId1 && m.role === "owner",
      ),
    ).toBe(true);
    expect(
      teamWithMembers.members.some(
        (m) => m.user_id === userId2 && m.role === "member",
      ),
    ).toBe(true);

    // Unassign member
    await teamDAO.unassign({
      user_id: userId2,
      team_id: team.id,
    });

    const afterUnassign = await teamDAO.get(team.id);
    expect(afterUnassign.members).toHaveLength(1);
    expect(afterUnassign.members[0].user_id).toBe(userId1);
  });
});
