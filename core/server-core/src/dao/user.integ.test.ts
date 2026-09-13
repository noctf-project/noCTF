import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { UserDAO } from "./user.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";
import { ConflictError, NotFoundError } from "../errors.ts";

describe(UserDAO, () => {
  let clients: TestClients;
  let dao: UserDAO;

  beforeAll(() => {
    clients = createTestClients();
    dao = new UserDAO(clients.getDb());
  });

  afterAll(async () => {
    await clients.destroy();
  });

  it("creates, retrieves, updates, and deletes users", async () => {
    const userId = await dao.create({
      name: "alice",
      bio: "crypto enthusiast",
      country: "US",
      roles: ["user"],
      flags: ["verified"],
    });

    expect(userId).toBeDefined();

    const user = await dao.get(userId);
    expect(user).toBeDefined();
    expect(user?.name).toBe("alice");
    expect(user?.country).toBe("US");

    const idByName = await dao.getIdForName("alice");
    expect(idByName).toBe(userId);

    const flagsAndRoles = await dao.getFlagsAndRoles(userId);
    expect(flagsAndRoles?.roles).toEqual(["user"]);
    expect(flagsAndRoles?.flags).toEqual(["verified"]);

    await dao.update(userId, { bio: "updated bio" });
    const userAfter = await dao.get(userId);
    expect(userAfter?.bio).toBe("updated bio");

    const count = await dao.getCount({ name: "alice" });
    expect(count).toBe(1);

    const summaryList = await dao.listSummary({ name: "alice" });
    expect(summaryList.some((u) => u.id === userId)).toBe(true);

    await dao.delete(userId);
    const afterDelete = await dao.get(userId);
    expect(afterDelete).toBeUndefined();
  });

  it("rejects duplicate user names", async () => {
    await dao.create({
      name: "bob_unique",
    });

    await expect(
      dao.create({
        name: "bob_unique",
      }),
    ).rejects.toThrow(ConflictError);
  });
});
