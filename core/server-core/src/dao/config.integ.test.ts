import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConfigDAO } from "./config.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";
import { BadRequestError } from "../errors.ts";

describe(ConfigDAO, () => {
  let clients: TestClients;
  let dao: ConfigDAO;

  beforeAll(() => {
    clients = createTestClients();
    dao = new ConfigDAO(clients.getDb());
  });

  afterAll(async () => {
    await clients.destroy();
  });

  it("registers, gets, and updates config values with optimistic locking", async () => {
    const initial = await dao.get("test.namespace");
    expect(initial.version).toBe(0);
    expect(initial.value).toEqual({});

    const registered = await dao.register("test.namespace", { foo: "bar" });
    expect(registered).toBe(true);

    // Registering again should do nothing (conflict on namespace)
    const registeredAgain = await dao.register("test.namespace", {
      foo: "baz",
    });
    expect(registeredAgain).toBe(false);

    const fetched = await dao.get<{ foo: string }>("test.namespace");
    expect(fetched.value.foo).toBe("bar");
    expect(fetched.version).toBe(1);

    // Update with correct version
    const updated = await dao.update(
      "test.namespace",
      { foo: "updated" },
      fetched.version,
    );
    expect(updated.version).toBe(2);

    const fetchedAfter = await dao.get<{ foo: string }>("test.namespace");
    expect(fetchedAfter.value.foo).toBe("updated");
    expect(fetchedAfter.version).toBe(2);

    // Update with mismatched version should throw BadRequestError
    await expect(
      dao.update("test.namespace", { foo: "conflict" }, 999),
    ).rejects.toThrow(BadRequestError);
  });
});
