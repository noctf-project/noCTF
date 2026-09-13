import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DivisionDAO } from "./division.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";
import { ConflictError, NotFoundError } from "../errors.ts";

describe(DivisionDAO, () => {
  let clients: TestClients;
  let dao: DivisionDAO;

  beforeAll(() => {
    clients = createTestClients();
    dao = new DivisionDAO(clients.getDb());
  });

  afterAll(async () => {
    await clients.destroy();
  });

  it("creates, retrieves, and lists divisions", async () => {
    const created = await dao.create({
      name: "Open Division",
      slug: "open",
      description: "Anyone can join",
      is_joinable: true,
      is_visible: true,
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe("Open Division");
    expect(created.slug).toBe("open");

    const fetched = await dao.get(created.id);
    expect(fetched).toBeDefined();
    expect(fetched?.name).toBe("Open Division");

    const all = await dao.list();
    expect(all.some((d) => d.id === created.id)).toBe(true);
  });

  it("enforces unique constraint on duplicate division slug/name", async () => {
    await dao.create({
      name: "High School",
      slug: "high-school",
      description: "HS division",
      is_joinable: true,
      is_visible: true,
    });

    await expect(
      dao.create({
        name: "High School",
        slug: "high-school",
        description: "Duplicate",
        is_joinable: true,
        is_visible: true,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("updates and deletes division", async () => {
    const division = await dao.create({
      name: "Temporary",
      slug: "temp",
      description: "Temp division",
      is_joinable: true,
      is_visible: true,
    });

    await dao.update(division.id, {
      name: "Updated Name",
      description: "Updated desc",
    });

    const updated = await dao.get(division.id);
    expect(updated?.name).toBe("Updated Name");
    expect(updated?.description).toBe("Updated desc");

    await dao.delete(division.id);
    const afterDelete = await dao.get(division.id);
    expect(afterDelete).toBeUndefined();
  });

  it("throws NotFoundError when updating non-existent division", async () => {
    await expect(dao.update(999999, { name: "Non-existent" })).rejects.toThrow(
      NotFoundError,
    );
  });
});
