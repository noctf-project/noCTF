import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AnnouncementDAO } from "./announcement.ts";
import { UserDAO } from "./user.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";
import { NotFoundError } from "../errors.ts";

describe(AnnouncementDAO, () => {
  let clients: TestClients;
  let dao: AnnouncementDAO;
  let userDAO: UserDAO;

  beforeAll(() => {
    clients = createTestClients();
    dao = new AnnouncementDAO(clients.getDb());
    userDAO = new UserDAO(clients.getDb());
  });

  afterAll(async () => {
    await clients.destroy();
  });

  it("creates, queries, updates, and deletes announcements", async () => {
    const userId = await userDAO.create({ name: "admin_announcer" });

    const ann = await dao.create({
      title: "CTF Starts Soon",
      message: "Get ready!",
      created_by: userId,
      updated_by: userId,
      visible_to: ["public"],
      delivery_channels: ["web"],
      important: true,
    });

    expect(ann.id).toBeDefined();
    expect(ann.version).toBe(1);
    expect(ann.title).toBe("CTF Starts Soon");

    const fetched = await dao.get(ann.id);
    expect(fetched.title).toBe("CTF Starts Soon");
    expect(fetched.important).toBe(true);

    const count = await dao.getCount({ visible_to: ["public"] });
    expect(count).toBeGreaterThanOrEqual(1);

    const list = await dao.query({ visible_to: ["public"] });
    expect(list.some((a) => a.id === ann.id)).toBe(true);

    const updated = await dao.update(ann.id, ann.version, {
      title: "CTF Has Started!",
    });
    expect(updated.version).toBe(2);

    await dao.delete(ann.id, updated.version);
    await expect(dao.get(ann.id)).rejects.toThrow(NotFoundError);
  });
});
