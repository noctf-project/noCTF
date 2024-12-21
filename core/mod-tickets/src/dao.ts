import { DatabaseClient, DBType } from "@noctf/server-core/clients/database";
import { Ticket, TicketState, UpdateTicket } from "./schema/datatypes.ts";
import { NotFoundError } from "@noctf/server-core/errors";
import { FilterUndefined } from "./util.ts";

export class TicketDAO {
  async create(
    db: DBType,
    {
      category,
      item,
      team_id,
      user_id,
      assignee_id,
      provider,
      provider_id,
      provider_metadata,
    }: Partial<Ticket>,
  ): Promise<Ticket> {
    const { id, created_at } = await db
      .insertInto("core.ticket")
      .values({
        state: TicketState.Created,
        category,
        item,
        team_id,
        user_id,
        assignee_id,
        provider,
        provider_id,
        provider_metadata,
      })
      .returning(["id", "created_at"])
      .executeTakeFirst();

    return {
      id,
      state: TicketState.Created,
      category,
      item,
      team_id,
      user_id,
      assignee_id: assignee_id || null,
      provider,
      provider_id: provider_id || null,
      provider_metadata: provider_metadata || null,
      created_at,
    };
  }

  async get(db: DBType, id: number) {
    const result = await db
      .selectFrom("core.ticket")
      .select([
        "id",
        "state",
        "category",
        "item",
        "team_id",
        "user_id",
        "assignee_id",
        "provider",
        "provider_id",
        "provider_metadata",
        "created_at",
      ])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!result) {
      throw new NotFoundError("Ticket not found");
    }
    return result as Ticket;
  }

  async getState(db: DBType, id: number) {
    const data = await db
      .selectFrom("core.ticket")
      .select("state")
      .where("id", "=", id)
      .executeTakeFirst();
    if (!data) {
      throw new NotFoundError("Ticket not found");
    }
    return data.state;
  }

  async update(db: DBType, id: number, properties: UpdateTicket) {
    const { numUpdatedRows } = await db
      .updateTable("core.ticket")
      .set(FilterUndefined(properties))
      .where("id", "=", id)
      .executeTakeFirst();
    if (!numUpdatedRows) {
      throw new NotFoundError("Ticket not found");
    }
  }
}
