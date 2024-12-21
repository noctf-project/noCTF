import { ServiceCradle } from "@noctf/server-core";
import {
  Ticket,
  TicketApplyMessage,
  TicketState,
  TicketStateMessage,
  UpdateTicket,
} from "./schema/datatypes.ts";
import { BadRequestError, ConflictError } from "@noctf/server-core/errors";
import { TicketConfig } from "./schema/config.ts";
import { TicketDAO } from "./dao.ts";
import { Value } from "@sinclair/typebox/value";

type Props = Pick<
  ServiceCradle,
  | "databaseClient"
  | "configService"
  | "eventBusService"
  | "lockService"
  | "logger"
>;

export const LEASE_DURATION = 10;

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
    actor: string,
    params: Pick<Ticket, "category" | "item" | "team_id" | "user_id">,
  ): Promise<Ticket> {
    const {
      value: { provider },
    } = await this.configService.get<TicketConfig>(TicketConfig.$id);
    if (!provider) {
      throw new Error("A provider has not been configured");
    }
    const ticket = await this.dao.create(this.databaseClient.get(), {
      ...params,
      provider,
    });

    const lease = await this.acquireLease(ticket.id);
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

  async requestStateChange(
    actor: string,
    id: number,
    desired_state: TicketState,
  ) {
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
      const lease = await this.acquireLease(id);
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

  async acquireLease(id: number) {
    return this.lockService.acquireLease(`ticket:${id}`, LEASE_DURATION);
  }

  async dropLease(id: number, token: string) {
    try {
      await this.lockService.dropLease(`ticket:${id}`, token);
    } catch (e) {
      this.logger.warn("Ticket has invalid lease token, however will ignore");
    }
  }

  async update(id: number, properties: UpdateTicket) {
    await this.dao.update(
      this.databaseClient.get(),
      id,
      Value.Clean(UpdateTicket, properties),
    );
  }

  async apply(actor: string, id: number, properties: UpdateTicket) {
    const lease = await this.acquireLease(id);
    try {
      await this.update(id, properties);
      await this.eventBusService.publish("queue.ticket.apply", {
        lease,
        properties,
        id,
      } as TicketApplyMessage);
    } catch (e) {
      this.logger.error(
        { stack: e.stack },
        "Could not update and apply properties",
      );
      if (lease) {
        await this.dropLease(id, lease);
      }
      throw e;
    }
  }
}
