import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ChallengeDAO } from "./challenge.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";
import { ConflictError, NotFoundError } from "../errors.ts";

describe(ChallengeDAO, () => {
  let clients: TestClients;
  let dao: ChallengeDAO;

  beforeAll(() => {
    clients = createTestClients();
    dao = new ChallengeDAO(clients.getDb());
  });

  afterAll(async () => {
    await clients.destroy();
  });

  const defaultMetadata = {
    solve: { source: "flag" },
    score: { strategy: "core:static", params: { base: 100 } },
    files: [],
  };

  it("creates, retrieves by id or slug, lists, updates, and deletes challenges", async () => {
    const chal = await dao.create({
      title: "Buffer Overflow 101",
      slug: "bof-101",
      description: "Simple bof challenge",
      tags: { category: "pwn", difficulty: "intro" },
      hidden: false,
      visible_at: null,
      private_metadata: defaultMetadata,
    });

    expect(chal.id).toBeDefined();
    expect(chal.slug).toBe("bof-101");
    expect(chal.version).toBe(1);

    const byId = await dao.get(chal.id);
    expect(byId.slug).toBe("bof-101");

    const bySlug = await dao.get("bof-101");
    expect(bySlug.id).toBe(chal.id);

    const list = await dao.list({ tags: { category: "pwn" }, hidden: false });
    expect(list.some((c) => c.id === chal.id)).toBe(true);

    const updated = await dao.update(chal.id, {
      title: "Buffer Overflow 101 (Updated)",
      version: chal.version,
    });
    expect(updated.version).toBe(2);

    await dao.delete(chal.id);
    await expect(dao.get(chal.id)).rejects.toThrow(NotFoundError);
  });

  it("enforces uniqueness on challenge slug", async () => {
    await dao.create({
      title: "Crypto 1",
      slug: "crypto-1",
      description: "crypto desc",
      tags: { category: "crypto" },
      hidden: false,
      visible_at: null,
      private_metadata: defaultMetadata,
    });

    await expect(
      dao.create({
        title: "Crypto 1 Duplicate",
        slug: "crypto-1",
        description: "dup",
        tags: { category: "crypto" },
        hidden: false,
        visible_at: null,
        private_metadata: defaultMetadata,
      }),
    ).rejects.toThrow(ConflictError);
  });
});
