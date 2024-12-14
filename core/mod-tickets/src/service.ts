import { ServiceCradle } from "@noctf/server-core";
import { Ticket } from "./schema/datatypes.ts";
import { NotFoundError } from "@noctf/server-core/errors";
import { TicketConfig } from "./schema/config.ts";
import { TicketStateMessage } from "./schema/messages.ts";

type Props = Pick<
  ServiceCradle,
  "databaseClient" | "configService" | "eventBusService"
>;
export class TicketService {
  private readonly configService;
  private readonly databaseClient;
  private readonly eventBusService;

  constructor({ configService, databaseClient, eventBusService }: Props) {
    this.configService = configService;
    this.databaseClient = databaseClient;
    this.eventBusService = eventBusService;
  }

  async create(
    actor: string,
    {
      category,
      item,
      team_id,
      user_id,
    }: Omit<Ticket, "id" | "open" | "created_at" | "provider" | "provider_id">,
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
      user_id: user_id,
      provider,
      created_at,
    };

    await this.eventBusService.publish("ticket.state", {
      actor,
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

  private async flipState(
    actor: string,
    id: number,
    open: boolean,
  ): Promise<Ticket> {
    const ticket = await this.databaseClient
      .updateTable("core.ticket")
      .set({
        open,
      })
      .where("id", "=", id)
      .where("open", "=", !open)
      .returning([
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
      .executeTakeFirst();
    if (!ticket) {
      throw new NotFoundError(
        "A ticket with the id and opposite state was not found",
      );
    }
    await this.eventBusService.publish("ticket.state", {
      actor,
      ticket,
    } as TicketStateMessage);
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
      throw new Error("Could not find ticket with ID and an empty provider ID");
    }
  }
}
