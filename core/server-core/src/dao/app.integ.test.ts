import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AppDAO } from "./app.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";
import { ConflictError, NotFoundError } from "../errors.ts";

describe(AppDAO, () => {
  let clients: TestClients;
  let dao: AppDAO;

  beforeAll(() => {
    clients = createTestClients();
    dao = new AppDAO(clients.getDb());
  });

  afterAll(async () => {
    await clients.destroy();
  });

  it("creates, retrieves by client_id, updates, and deletes apps", async () => {
    const app = await dao.create({
      name: "Discord Bot",
      client_id: "discord_client_1",
      client_secret_hash: Buffer.from("hash123"),
      redirect_uris: ["https://discord.com/oauth"],
      scopes: ["read:teams"],
      enabled: true,
    });

    expect(app.id).toBeDefined();
    expect(app.client_id).toBe("discord_client_1");

    const fetched = await dao.getByActiveClientID("discord_client_1");
    expect(fetched.name).toBe("Discord Bot");

    const list = await dao.list();
    expect(list.some((a) => a.id === app.id)).toBe(true);

    const updated = await dao.update(app.id, {
      name: "Discord Bot (Updated)",
      client_id: "discord_client_1",
      client_secret_hash: Buffer.from("hash123"),
      redirect_uris: ["https://discord.com/oauth2"],
      scopes: ["read:teams", "write:teams"],
      enabled: true,
    });
    expect(updated.name).toBe("Discord Bot (Updated)");

    await dao.delete(app.id);
    await expect(dao.getByActiveClientID("discord_client_1")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("prevents duplicate client_id", async () => {
    await dao.create({
      name: "App 1",
      client_id: "duplicate_id",
      client_secret_hash: Buffer.from("hash1"),
      redirect_uris: [],
      scopes: [],
      enabled: true,
    });

    await expect(
      dao.create({
        name: "App 2",
        client_id: "duplicate_id",
        client_secret_hash: Buffer.from("hash2"),
        redirect_uris: [],
        scopes: [],
        enabled: true,
      }),
    ).rejects.toThrow(ConflictError);
  });
});
