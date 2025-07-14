import type { ServiceCradle } from "@noctf/server-core";
import type { Ticket, TicketApplyMessage } from "./schema/datatypes.ts";
import {
  TicketState,
  TicketStateMessage,
  UpdateTicket,
} from "./schema/datatypes.ts";
import {
  BadRequestError,
  ConflictError,
  NotImplementedError,
} from "@noctf/server-core/errors";
import { TicketConfig } from "./schema/config.ts";
import { TicketDAO } from "./dao.ts";
import { Value } from "@sinclair/typebox/value";
import { FilterUndefined } from "./util.ts";

type Props = Pick<
  ServiceCradle,
  | "databaseClient"
  | "configService"
  | "eventBusService"
  | "lockService"
  | "logger"
>;

export const LEASE_DURATION = 60;

export class TicketService {
  private readonly configService;
  private readonly databaseClient;
  private readonly eventBusService;
  private readonly lockService;
  private readonly logger;
  private readonly dao;

  constructor({
    configService,
    databaseClient,
    eventBusService,
    lockService,
    logger,
  }: Props) {
    this.configService = configService;
    this.databaseClient = databaseClient;
    this.eventBusService = eventBusService;
    this.lockService = lockService;
    this.logger = logger;
    this.dao = new TicketDAO();
  }

  async create(
    params: Pick<Ticket, "category" | "item" | "team_id" | "user_id">,
    actor: string,
  ): Promise<Ticket> {
    const {
      value: { provider },
    } = await this.configService.get(TicketConfig);
    if (!provider) {
      throw new NotImplementedError("A provider has not been configured");
    }
    const ticket = await this.dao.create(this.databaseClient.get(), {
      ...params,
      provider,
    });

    const lease = await this.acquireLease(ticket.id, "state");
    await this.eventBusService.publish("queue.ticket.state", {
      lease,
      id: ticket.id,
      desired_state: TicketState.Open,
    } as TicketStateMessage);
    return ticket;
  }

  async get(id: number) {
    return this.dao.get(this.databaseClient.get(), id);
  }

  private async requestStateChange(id: number, desired_state: TicketState) {
    if (
      !Value.Check(TicketStateMessage.properties.desired_state, desired_state)
    ) {
      throw new BadRequestError("The state requested is invalid");
    }
    if (
      (await this.dao.getState(this.databaseClient.get(), id)) === desired_state
    ) {
      return;
    }

    try {
      const lease = await this.acquireLease(id, "state");
      await this.eventBusService.publish("queue.ticket.state", {
        lease,
        desired_state,
        id,
      } as TicketStateMessage);
    } catch (e) {
      throw new ConflictError(
        "A request to change the ticket state has not been completed.",
      );
    }
  }

  private async acquireLease(id: number, type: "state" | "apply") {
    return this.lockService.acquireLease(
      `ticket:${id}:${type}`,
      LEASE_DURATION,
    );
  }

  async dropLease(id: number, type: "state" | "apply", token: string) {
    try {
      await this.lockService.dropLease(`ticket:${id}:${type}`, token);
    } catch (err) {
      this.logger.warn(
        err,
        "Ticket has invalid lease token, however will ignore",
      );
    }
  }

  /**
   * Update ticket without applying
   * @param id id
   * @param properties properties
   */
  async update(id: number, properties: UpdateTicket) {
    return this.dao.update(
      this.databaseClient.get(),
      id,
      Value.Clean(UpdateTicket, properties),
    );
  }

  async getSpec(category: string, item: string) {
    return {
      category,
      item,
    };
  }

  async apply(
    id: number,
    properties: UpdateTicket,
    actor: string,
  ): Promise<Pick<Ticket, "updated_at" | "state"> | undefined> {
    const lease = await this.acquireLease(id, "apply");
    const { state, ...other } = properties;
    try {
      let result: Pick<Ticket, "updated_at" | "state"> | undefined;
      const toApply = FilterUndefined(other);
      if (Object.keys(toApply).length) result = await this.update(id, toApply);
      if (state) {
        await this.requestStateChange(id, state);
        await this.dropLease(id, "apply", lease);
      } else {
        await this.eventBusService.publish("queue.ticket.apply", {
          lease,
          properties,
          id,
        } as TicketApplyMessage);
      }
      return result;
    } catch (err) {
      this.logger.error(err, "Could not update and apply properties");
      if (lease) {
        await this.dropLease(id, "apply", lease);
      }
      throw err;
    }
  }
}
