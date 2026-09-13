import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TeamTagDAO } from "./team_tag.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";
import { NotFoundError } from "../errors.ts";

describe(TeamTagDAO, () => {
  let clients: TestClients;
  let dao: TeamTagDAO;

  beforeAll(() => {
    clients = createTestClients();
    dao = new TeamTagDAO(clients.getDb());
  });

  afterAll(async () => {
    await clients.destroy();
  });

  it("creates, lists, and deletes team tags", async () => {
    const tag = await dao.create({
      name: "University",
      description: "University students",
      is_joinable: true,
    });

    expect(tag.id).toBeGreaterThan(0);
    expect(tag.name).toBe("University");

    const list = await dao.list();
    expect(list.some((t) => t.id === tag.id)).toBe(true);

    await dao.delete(tag.id);

    const listAfter = await dao.list();
    expect(listAfter.some((t) => t.id === tag.id)).toBe(false);
  });

  it("throws NotFoundError when deleting non-existent tag", async () => {
    await expect(dao.delete(999999)).rejects.toThrow(NotFoundError);
  });
});
