import { DatabaseClient } from "@noctf/server-core/clients/database";
import { ConfigService } from "@noctf/server-core/services/config";
import { EventBusService } from "@noctf/server-core/services/event_bus";
import { LockService } from "@noctf/server-core/services/lock";
import { describe, it, beforeEach, vi, expect, Mock } from "vitest";
import { anyNumber, mock } from "vitest-mock-extended";
import { TicketService } from "./service.ts";
import { ConflictError } from "@noctf/server-core/errors";

const date = new Date("1970-01-01T00:00:00.000Z");
describe("TicketService", () => {
  const configService = mock<ConfigService>();

  const databaseClient = {
    insertInto: vi.fn(),
    updateTable: vi.fn(),
    selectFrom: vi.fn(),
  };
  const eventBusService = mock<EventBusService>();
  const lockService = mock<LockService>();

  const props = {
    configService,
    databaseClient: databaseClient as unknown as DatabaseClient,
    eventBusService,
    lockService,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("Fails to create a ticket if no provider", async () => {
    const service = new TicketService(props);
    configService.get.mockResolvedValue({ value: {}, version: 1 });
    await expect(() =>
      service.create("user:1", {
        category: "test",
        item: "test",
        team_id: 1,
      }),
    ).rejects.toThrowError("A provider has not been configured");
  });

  it("Creates a ticket", async () => {
    const service = new TicketService(props);
    configService.get.mockResolvedValue({
      value: { provider: "test-provider" },
      version: 1,
    });
    const insert = {
      values: databaseClient.insertInto,
      returning: databaseClient.insertInto,
      executeTakeFirst: databaseClient.insertInto,
    };
    databaseClient.insertInto.mockReturnValueOnce(insert);
    insert.values.mockReturnValueOnce(insert);
    insert.returning.mockReturnValueOnce(insert);
    insert.executeTakeFirst.mockResolvedValueOnce({
      id: 42,
      created_at: date,
    });
    lockService.acquireLease.mockResolvedValueOnce("token");
    const ticket = {
      id: 42,
      open: true,
      item: "test",
      category: "test",
      team_id: 1,
      provider: "test-provider",
      created_at: date,
    };
    expect(
      await service.create("user:1", {
        category: "test",
        item: "test",
        team_id: 1,
      }),
    ).toMatchObject(ticket);
    expect(lockService.acquireLease).toHaveBeenCalledWith(
      "ticket:state:42",
      anyNumber(),
    );
    expect(eventBusService.publish).toHaveBeenCalledWith("ticket.state", {
      actor: "user:1",
      lease: "token",
      ticket,
    });
  });

  it("Closes a ticket", async () => {
    const service = new TicketService(props);
    const ticket = {
      id: 42,
      open: true,
      item: "test",
      category: "test",
      team_id: 1,
      provider: "test-provider",
      created_at: date,
    };
    const select = {
      selectFrom: databaseClient.selectFrom,
      select: databaseClient.selectFrom,
      where: databaseClient.selectFrom,
      executeTakeFirst: databaseClient.selectFrom,
    };
    databaseClient.selectFrom.mockReturnValueOnce(select);
    select.select.mockReturnValueOnce(select);
    select.where.mockReturnValueOnce(select);
    select.executeTakeFirst.mockResolvedValueOnce(ticket);
    const update = {
      set: databaseClient.updateTable,
      where: databaseClient.updateTable,
      executeTakeFirst: databaseClient.updateTable,
    };
    databaseClient.updateTable.mockReturnValueOnce(update);
    update.set.mockReturnValueOnce(update);
    update.where.mockReturnValueOnce(update);
    update.where.mockReturnValueOnce(update);
    update.executeTakeFirst.mockResolvedValueOnce({
      numUpdatedRows: 1,
    });
    lockService.acquireLease.mockResolvedValueOnce("token");
    expect(await service.close("user:1", 42)).toMatchObject(ticket);
    expect(update.set).toBeCalledWith({ open: false });
    expect(lockService.acquireLease).toHaveBeenCalledWith(
      "ticket:state:42",
      anyNumber(),
    );
    expect(eventBusService.publish).toHaveBeenCalledWith("ticket.state", {
      actor: "user:1",
      lease: "token",
      ticket,
    });
  });

  it("Fails to close a ticket if lease exists", async () => {
    const service = new TicketService(props);
    const ticket = {
      id: 42,
      open: true,
      item: "test",
      category: "test",
      team_id: 1,
      provider: "test-provider",
      created_at: date,
    };
    const select = {
      selectFrom: databaseClient.selectFrom,
      select: databaseClient.selectFrom,
      where: databaseClient.selectFrom,
      executeTakeFirst: databaseClient.selectFrom,
    };
    databaseClient.selectFrom.mockReturnValueOnce(select);
    select.select.mockReturnValueOnce(select);
    select.where.mockReturnValueOnce(select);
    select.executeTakeFirst.mockResolvedValueOnce(ticket);
    lockService.acquireLease.mockRejectedValue("fail");
    await expect(() => service.close("user:1", 42)).rejects.toThrowError();
    expect(databaseClient.updateTable).not.toHaveBeenCalled;
    expect(eventBusService.publish).not.toHaveBeenCalled;
  });

  it("returns the same ticket if update does not match any rows", async () => {
    const service = new TicketService(props);
    const ticket = {
      id: 42,
      open: true,
      item: "test",
      category: "test",
      team_id: 1,
      provider: "test-provider",
      created_at: date,
    };
    const select = {
      selectFrom: databaseClient.selectFrom,
      select: databaseClient.selectFrom,
      where: databaseClient.selectFrom,
      executeTakeFirst: databaseClient.selectFrom,
    };
    databaseClient.selectFrom.mockReturnValueOnce(select);
    select.select.mockReturnValueOnce(select);
    select.where.mockReturnValueOnce(select);
    select.executeTakeFirst.mockResolvedValueOnce(ticket);
    const update = {
      set: databaseClient.updateTable,
      where: databaseClient.updateTable,
      executeTakeFirst: databaseClient.updateTable,
    };
    databaseClient.updateTable.mockReturnValueOnce(update);
    update.set.mockReturnValueOnce(update);
    update.where.mockReturnValueOnce(update);
    update.where.mockReturnValueOnce(update);
    update.executeTakeFirst.mockResolvedValueOnce({
      numUpdatedRows: 0,
    });
    lockService.acquireLease.mockResolvedValueOnce("token");
    expect(await service.close("user:1", 42)).toMatchObject(ticket);
    expect(update.set).toBeCalledWith({ open: false });
    expect(lockService.acquireLease).toHaveBeenCalledWith(
      "ticket:state:42",
      anyNumber(),
    );
    expect(lockService.dropLease).toHaveBeenCalledWith(
      "ticket:state:42",
      "token",
    );
    expect(eventBusService.publish).not.toHaveBeenCalled;
  });

  it("sets the provider ID", async () => {
    const service = new TicketService(props);
    const update = {
      set: databaseClient.updateTable,
      where: databaseClient.updateTable,
      executeTakeFirst: databaseClient.updateTable,
    };
    databaseClient.updateTable.mockReturnValueOnce(update);
    update.set.mockReturnValueOnce(update);
    update.where.mockReturnValueOnce(update);
    update.where.mockReturnValueOnce(update);
    update.where.mockReturnValueOnce(update);
    update.executeTakeFirst.mockResolvedValueOnce({
      numUpdatedRows: 1,
    });
    await service.setProviderId(42, "test-provider", "1234");
    expect(update.set).toBeCalledWith({ provider_id: "1234" });
  });

  it("fails to set the provider ID", async () => {
    const service = new TicketService(props);
    const update = {
      set: databaseClient.updateTable,
      where: databaseClient.updateTable,
      executeTakeFirst: databaseClient.updateTable,
    };
    databaseClient.updateTable.mockReturnValueOnce(update);
    update.set.mockReturnValueOnce(update);
    update.where.mockReturnValueOnce(update);
    update.where.mockReturnValueOnce(update);
    update.where.mockReturnValueOnce(update);
    update.executeTakeFirst.mockResolvedValueOnce({
      numUpdatedRows: 0,
    });
    await expect(() =>
      service.setProviderId(42, "test-provider", "1234"),
    ).rejects.toThrowError("Could not find a valid ticket");
  });
});
