import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AuditLogDAO } from "./audit_log.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";

describe(AuditLogDAO, () => {
  let clients: TestClients;
  let dao: AuditLogDAO;

  beforeAll(() => {
    clients = createTestClients();
    dao = new AuditLogDAO(clients.getDb());
  });

  afterAll(async () => {
    await clients.destroy();
  });

  it("creates, queries, and counts audit log entries", async () => {
    await dao.create({
      actor: "admin_user",
      operation: "create_challenge",
      entities: ["challenge:123"],
      data: JSON.stringify({ title: "New Challenge" }),
    });

    const count = await dao.getCount({ actor: ["admin_user"] });
    expect(count).toBeGreaterThanOrEqual(1);

    const results = await dao.query({
      actor: ["admin_user"],
      operation: ["create%"],
    });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].actor).toBe("admin_user");
    expect(results[0].operation).toBe("create_challenge");
  });
});
