import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SessionDAO } from "./session.ts";
import { UserDAO } from "./user.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";
import { NotFoundError } from "../errors.ts";

describe(SessionDAO, () => {
  let clients: TestClients;
  let dao: SessionDAO;
  let userDAO: UserDAO;

  beforeAll(() => {
    clients = createTestClients();
    dao = new SessionDAO(clients.getDb());
    userDAO = new UserDAO(clients.getDb());
  });

  afterAll(async () => {
    await clients.destroy();
  });

  it("creates, retrieves, revokes, and lists user sessions", async () => {
    const userId = await userDAO.create({ name: "session_user" });
    const tokenHash = Buffer.from("0123456789abcdef0123456789abcdef");

    const sessionId = await dao.createSession({
      user_id: userId,
      app_id: null,
      refresh_token_hash: tokenHash,
      expires_at: new Date(Date.now() + 3600 * 1000),
      ip: "127.0.0.1",
      scopes: ["user"],
    });

    expect(sessionId).toBeDefined();

    const session = await dao.getByRefreshToken(tokenHash);
    expect(session.id).toBe(sessionId);
    expect(session.user_id).toBe(userId);

    const activeSessions = await dao.listByUserId(userId, true);
    expect(activeSessions).toHaveLength(1);

    const count = await dao.getCountByUserId(userId, true);
    expect(count).toBe(1);

    await dao.revokeSession(sessionId);

    const activeAfterRevoke = await dao.listByUserId(userId, true);
    expect(activeAfterRevoke).toHaveLength(0);

    await expect(dao.getByRefreshToken(tokenHash)).rejects.toThrow(
      NotFoundError,
    );
  });
});
