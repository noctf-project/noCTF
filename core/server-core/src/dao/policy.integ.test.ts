import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PolicyDAO } from "./policy.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";
import { ConflictError, NotFoundError } from "../errors.ts";

describe(PolicyDAO, () => {
  let clients: TestClients;
  let dao: PolicyDAO;

  beforeAll(() => {
    clients = createTestClients();
    dao = new PolicyDAO(clients.getDb());
  });

  afterAll(async () => {
    await clients.destroy();
  });

  it("creates, lists, updates, and deletes policies", async () => {
    const policy = await dao.create({
      name: "Admin Policy",
      description: "Full access",
      permissions: ["admin:*"],
      public: false,
      is_enabled: true,
      match_roles: ["admin"],
      omit_roles: [],
    });

    expect(policy.id).toBeDefined();
    expect(policy.version).toBe(1);
    expect(policy.name).toBe("Admin Policy");

    const list = await dao.list({ is_enabled: true });
    expect(list.some((p) => p.id === policy.id)).toBe(true);

    const updated = await dao.update(policy.id, {
      description: "Updated description",
      version: policy.version,
    });
    expect(updated.version).toBe(2);

    // Reject update with wrong version
    await expect(
      dao.update(policy.id, { description: "Stale", version: 1 }),
    ).rejects.toThrow(NotFoundError);

    await dao.delete(policy.id, updated.version);
    const listAfter = await dao.list();
    expect(listAfter.some((p) => p.id === policy.id)).toBe(false);
  });

  it("handles duplicate policy name", async () => {
    await dao.create({
      name: "Unique Policy Name",
      description: "desc",
      permissions: [],
    });

    await expect(
      dao.create({
        name: "Unique Policy Name",
        description: "duplicate",
        permissions: [],
      }),
    ).rejects.toThrow(ConflictError);
  });
});
