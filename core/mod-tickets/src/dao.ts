import type { DBType } from "@noctf/server-core/clients/database";
import type { Ticket, UpdateTicket } from "./schema/datatypes.ts";
import { TicketState } from "./schema/datatypes.ts";
import { NotFoundError } from "@noctf/server-core/errors";
import { FilterUndefined } from "./util.ts";

type CreateTicket = Pick<Ticket, "category" | "item" | "provider"> &
  Partial<
    Pick<
      Ticket,
      | "team_id"
      | "user_id"
      | "assignee_id"
      | "provider_id"
      | "provider_metadata"
    >
  >;

export class TicketDAO {
  async create(db: DBType, params: CreateTicket): Promise<Ticket> {
    const result = await db
      .insertInto("ticket")
      .values({
        state: TicketState.Created,
        ...params,
      })
      .returning(["id", "created_at"])
      .executeTakeFirst();
    if (!result) {
      throw new Error("Ticket insert returned no row");
    }

    return {
      id: result.id,
      state: TicketState.Created,
      category: params.category,
      item: params.item,
      team_id: params.team_id,
      user_id: params.user_id,
      assignee_id: params.assignee_id || null,
      provider: params.provider,
      provider_id: params.provider_id || null,
      provider_metadata: params.provider_metadata || null,
      created_at: result.created_at,
    };
  }

  async get(db: DBType, id: number) {
    const result = await db
      .selectFrom("ticket")
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
      .selectFrom("ticket")
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
      .updateTable("ticket")
      .set(FilterUndefined(properties))
      .where("id", "=", id)
      .executeTakeFirst();
    if (!numUpdatedRows) {
      throw new NotFoundError("Ticket not found");
    }
  }
}
