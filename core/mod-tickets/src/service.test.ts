import type { DatabaseClient } from "@noctf/server-core/clients/database";
import type { ConfigService } from "@noctf/server-core/services/config";
import type { EventBusService } from "@noctf/server-core/services/event_bus";
import type { LockService } from "@noctf/server-core/services/lock";
import { describe, it, beforeEach, vi, expect } from "vitest";
import { anyNumber, mock } from "vitest-mock-extended";
import { TicketService } from "./service.ts";
import type { Logger } from "@noctf/server-core/types/primitives";
import { TicketDAO } from "./dao.ts";
import type { Ticket } from "./schema/datatypes.ts";
import { TicketState } from "./schema/datatypes.ts";
import { BadRequestError, ConflictError } from "@noctf/server-core/errors";
import { ActorType } from "@noctf/server-core/types/enums";

vi.mock(import("./dao.ts"), () => ({
  TicketDAO: vi.fn(),
}));

const date = new Date("1970-01-01T00:00:00.000Z");

describe(TicketService, () => {
  const configService = mock<ConfigService>();
  const databaseClient = mock<DatabaseClient>();
  const eventBusService = mock<EventBusService>();
  const lockService = mock<LockService>();
  const logger = mock<Logger>();
  const ticketDAO = mock<TicketDAO>();

  const ticket: Ticket = {
    id: 42,
    state: TicketState.Created,
    item: "test",
    category: "test",
    team_id: 1,
    assignee_id: null,
    provider: "test-provider",
    provider_id: null,
    provider_metadata: null,
    created_at: date,
    updated_at: date,
  };

  const props = {
    configService,
    databaseClient,
    eventBusService,
    lockService,
    logger,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    databaseClient.get.mockReturnThis();
    vi.mocked(TicketDAO).mockReturnValue(ticketDAO);
  });

  it("Fails to create a ticket if no provider", async () => {
    const service = new TicketService(props);
    configService.get.mockResolvedValue({ value: {}, version: 1 });
    await expect(() =>
      service.create(
        {
          category: "test",
          item: "test",
          team_id: 1,
        },
        "user:1",
      ),
    ).rejects.toThrowError("A provider has not been configured");
  });

  it("Creates a ticket", async () => {
    const service = new TicketService(props);
    configService.get.mockResolvedValue({
      value: { provider: "test-provider" },
      version: 1,
    });

    lockService.acquireLease.mockResolvedValueOnce("token");

    ticketDAO.create.mockResolvedValue(ticket);
    expect(
      await service.create(
        {
          category: "test",
          item: "test",
          team_id: 1,
        },
        "user:1",
      ),
    ).toMatchObject(ticket);
    expect(lockService.acquireLease).toHaveBeenCalledWith(
      "ticket:42:state",
      anyNumber(),
    );
    expect(eventBusService.publish).toHaveBeenCalledWith("queue.ticket.state", {
      lease: "token",
      id: 42,
      desired_state: TicketState.Open,
    });
  });

  it("Ticket state change publishes a message to queue if status is different", async () => {
    const service = new TicketService(props);
    ticketDAO.getState.mockResolvedValueOnce(TicketState.Created);
    lockService.acquireLease.mockResolvedValueOnce("lease");
    await service.requestStateChange(42, TicketState.Open);
    expect(eventBusService.publish).toBeCalledWith("queue.ticket.state", {
      lease: "lease",
      desired_state: TicketState.Open,
      id: 42,
    });
  });

  it("Ticket state does not publish a message if the current state is the same", async () => {
    const service = new TicketService(props);
    ticketDAO.getState.mockResolvedValueOnce(TicketState.Open);
    lockService.acquireLease.mockResolvedValueOnce("lease");
    await service.requestStateChange(42, TicketState.Open);
    expect(lockService.acquireLease).not.toBeCalled();
    expect(eventBusService.publish).not.toBeCalled();
  });

  it("Throws error if ticket state does not exist", async () => {
    const service = new TicketService(props);
    expect(() =>
      service.requestStateChange(42, "NonExistent" as TicketState),
    ).rejects.toThrowError(BadRequestError);
  });

  it("Ticket state throws an error if it fails to acquire a lease", async () => {
    const service = new TicketService(props);
    ticketDAO.getState.mockResolvedValueOnce(TicketState.Created);
    lockService.acquireLease.mockRejectedValueOnce(new Error("lol"));
    await expect(() =>
      service.requestStateChange(42, TicketState.Open),
    ).rejects.toThrowError(ConflictError);
    expect(eventBusService.publish).not.toBeCalled();
  });

  it("successfully drops the lease", async () => {
    const service = new TicketService(props);
    await service.dropLease(42, "apply", "token");
    expect(lockService.dropLease).toBeCalledWith("ticket:42:apply", "token");
  });

  it("does not throw when dropping the lease if it returns an error", async () => {
    const service = new TicketService(props);
    lockService.dropLease.mockRejectedValueOnce("oops");
    await service.dropLease(42, "apply", "token");
  });

  it("gets the ticket details", async () => {
    const service = new TicketService(props);
    ticketDAO.get.mockResolvedValue(ticket);
    expect(await service.get(42)).to.eql(ticket);
  });

  it("updates the DB", async () => {
    const service = new TicketService(props);
    await service.update(42, {
      provider_id: "1",
      state: TicketState.Open,
    });
    expect(ticketDAO.update).toBeCalledWith(databaseClient, 42, {
      provider_id: "1",
      state: TicketState.Open,
    });
  });

  it("apply updates the DB and sends out a message", async () => {
    const service = new TicketService(props);
    lockService.acquireLease.mockResolvedValue("lease");
    await service.apply(
      42,
      {
        assignee_id: 1,
      },
      "user:1",
    );
    expect(ticketDAO.update).toBeCalledWith(databaseClient, 42, {
      assignee_id: 1,
    });
    expect(eventBusService.publish).toBeCalledWith("queue.ticket.apply", {
      lease: "lease",
      properties: { assignee_id: 1 },
      id: 42,
    });
  });

  it("apply releases the lease if failed", async () => {
    const service = new TicketService(props);
    lockService.acquireLease.mockResolvedValue("lease");
    ticketDAO.update.mockRejectedValue(Error);
    await expect(() =>
      service.apply(
        42,
        {
          assignee_id: 1,
        },
        "user:1",
      ),
    ).rejects.toThrowError();
    expect(lockService.dropLease).toBeCalledWith("ticket:42:apply", "lease");
  });
});
