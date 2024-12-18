import { ServiceCradle } from "@noctf/server-core";
import { Ticket } from "./schema/datatypes.ts";
import { ConflictError, NotFoundError } from "@noctf/server-core/errors";
import { TicketConfig } from "./schema/config.ts";
import { TicketStateMessage } from "./schema/messages.ts";

type Props = Pick<
  ServiceCradle,
  "databaseClient" | "configService" | "eventBusService" | "lockService"
>;

export const LEASE_DURATION = 60;

export class TicketService {
  private readonly configService;
  private readonly databaseClient;
  private readonly eventBusService;
  private readonly lockService;

  constructor({
    configService,
    databaseClient,
    eventBusService,
    lockService,
  }: Props) {
    this.configService = configService;
    this.databaseClient = databaseClient;
    this.eventBusService = eventBusService;
    this.lockService = lockService;
  }

  async create(
    actor: string,
    {
      category,
      item,
      team_id,
      user_id,
    }: Pick<Ticket, "category" | "item" | "team_id" | "user_id">,
  ): Promise<Ticket> {
    const {
      value: { provider },
    } = await this.configService.get<TicketConfig>(TicketConfig.$id);
    if (!provider) {
      throw new Error("A provider has not been configured");
    }
    const { id, created_at } = await this.databaseClient
      .insertInto("core.ticket")
      .values({
        open: true,
        category,
        item,
        team_id,
        user_id,
        provider,
      })
      .returning(["id", "created_at"])
      .executeTakeFirst();

    const ticket: Ticket = {
      id,
      open: true,
      category,
      item,
      team_id,
      user_id,
      provider,
      created_at,
    };

    const lease = await this.acquireStateLease(id);
    await this.eventBusService.publish("events.ticket.state.open", {
      actor,
      lease,
      ticket,
    } as TicketStateMessage);
    return ticket;
  }

  async open(actor: string, id: number): Promise<Ticket> {
    return this.flipState(actor, id, true);
  }

  async close(actor: string, id: number): Promise<Ticket> {
    return this.flipState(actor, id, false);
  }

  async acquireStateLease(id: number) {
    return this.lockService.acquireLease(`ticket:state:${id}`, LEASE_DURATION);
  }

  async renewStateLease(id: number, token: string) {
    return this.lockService.renewLease(
      `ticket:state:${id}`,
      token,
      LEASE_DURATION,
    );
  }

  async dropStateLease(id: number, token: string) {
    return this.lockService.dropLease(`ticket:state:${id}`, token);
  }

  private async flipState(
    actor: string,
    id: number,
    open: boolean,
  ): Promise<Ticket> {
    const ticket = await this.databaseClient
      .selectFrom("core.ticket")
      .select([
        "id",
        "open",
        "team_id",
        "user_id",
        "category",
        "item",
        "provider",
        "provider_id",
        "created_at",
      ])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!ticket) {
      throw new NotFoundError("A ticket with the id was not found");
    }
    if (ticket.open === open) {
      return ticket;
    }
    let lease;
    try {
      lease = await this.acquireStateLease(id);
    } catch (e) {
      throw new ConflictError(
        "A change ticket state operation is currently ongoing.",
      );
    }

    const { numUpdatedRows } = await this.databaseClient
      .updateTable("core.ticket")
      .set({
        open,
      })
      .where("id", "=", id)
      .where("open", "=", ticket.open)
      .executeTakeFirst();
    if (numUpdatedRows > 0) {
      ticket.open = open;
      await this.eventBusService.publish(
        `events.ticket.state.${open ? "open" : "closed"}`,
        {
          actor,
          lease,
          ticket,
        } as TicketStateMessage,
      );
    } else {
      await this.dropStateLease(id, lease);
    }
    return ticket;
  }

  async setProviderId(id: number, provider: string, providerId: string) {
    const { numUpdatedRows } = await this.databaseClient
      .updateTable("core.ticket")
      .set({
        provider_id: providerId,
      })
      .where("id", "=", id)
      .where("provider", "=", provider)
      .where("provider_id", "is", null)
      .executeTakeFirst();
    if (!numUpdatedRows) {
      throw new Error("Could not find a valid ticket");
    }
  }
}
