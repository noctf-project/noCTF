import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FileDAO } from "./file.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";
import { NotFoundError } from "../errors.ts";

describe(FileDAO, () => {
  let clients: TestClients;
  let dao: FileDAO;

  beforeAll(() => {
    clients = createTestClients();
    dao = new FileDAO(clients.getDb());
  });

  afterAll(async () => {
    await clients.destroy();
  });

  it("creates, gets, and deletes files", async () => {
    const file = await dao.create({
      filename: "test.png",
      provider: "s3",
      hash: "abc123hash",
      size: 1024,
      ref: "s3://bucket/test.png",
      mime: "image/png",
    });

    expect(file.id).toBeDefined();
    expect(file.size).toBe(1024);

    const fetched = await dao.get(file.id);
    expect(fetched.filename).toBe("test.png");
    expect(fetched.ref).toBe("s3://bucket/test.png");
    expect(fetched.size).toBe(1024);

    await dao.delete(file.id);
    await expect(dao.get(file.id)).rejects.toThrow(NotFoundError);
  });
});
