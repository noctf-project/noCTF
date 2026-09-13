import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { UserDAO } from "./user.ts";
import { UserIdentityDAO } from "./user_identity.ts";
import { createTestClients, TestClients } from "../test/integ-clients.ts";
import { ConflictError } from "../errors.ts";

describe(UserIdentityDAO, () => {
  let clients: TestClients;
  let userDAO: UserDAO;
  let dao: UserIdentityDAO;

  beforeAll(() => {
    clients = createTestClients();
    userDAO = new UserDAO(clients.getDb());
    dao = new UserIdentityDAO(clients.getDb());
  });

  afterAll(async () => {
    await clients.destroy();
  });

  it("associates, retrieves, and disassociates user identities", async () => {
    const userId1 = await userDAO.create({ name: "charlie" });
    const userId2 = await userDAO.create({ name: "david" });

    await dao.associate({
      user_id: userId1,
      provider: "github",
      provider_id: "gh_12345",
      secret_data: "token_abc",
    });

    const identity = await dao.getIdentityForUser(userId1, "github");
    expect(identity).toBeDefined();
    expect(identity?.provider_id).toBe("gh_12345");

    // Same user updating same provider should update
    await dao.associate({
      user_id: userId1,
      provider: "github",
      provider_id: "gh_12345_updated",
      secret_data: "token_def",
    });
    const identityUpdated = await dao.getIdentityForUser(userId1, "github");
    expect(identityUpdated?.provider_id).toBe("gh_12345_updated");

    // Associating same provider + provider_id to a DIFFERENT user should throw ConflictError
    await expect(
      dao.associate({
        user_id: userId2,
        provider: "github",
        provider_id: "gh_12345_updated",
      }),
    ).rejects.toThrow(ConflictError);

    await dao.disAssociate({ user_id: userId1, provider: "github" });
    const identityAfter = await dao.getIdentityForUser(userId1, "github");
    expect(identityAfter).toBeUndefined();
  });
});
