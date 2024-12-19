import { ServiceCradle } from "@noctf/server-core";
import { Ticket, TicketState } from "./schema/datatypes.ts";
import { ConflictError, NotFoundError } from "@noctf/server-core/errors";
import { TicketConfig } from "./schema/config.ts";
import { TicketStateUpdateMessage } from "./schema/messages.ts";
import { TicketDAO } from "./dao.ts";

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

    const lease = await this.acquireStateLease(ticket.id);
    await this.eventBusService.publish("queue.ticket.state", {
      actor,
      lease,
      id: ticket.id,
      desired_state: TicketState.Open,
    } as TicketStateUpdateMessage);
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
      (await this.dao.getState(this.databaseClient.get(), id)) === desired_state
    ) {
      return;
    }

    try {
      const lease = await this.acquireStateLease(id);
      await this.eventBusService.publish("queue.ticket.state", {
        actor,
        lease,
        desired_state,
        id,
      } as TicketStateUpdateMessage);
    } catch (e) {
      throw new ConflictError(
        "A request to change the ticket state has not been completed.",
      );
    }
  }

  async acquireStateLease(id: number) {
    return this.lockService.acquireLease(`ticket:state:${id}`, LEASE_DURATION);
  }

  async dropStateLease(id: number, token: string) {
    try {
      await this.lockService.dropLease(`ticket:state:${id}`, token);
    } catch (e) {
      this.logger.warn("Ticket has invalid lease token, however will ignore");
    }
  }

  async updateStateOrProvider(
    id: number,
    values: Partial<Pick<Ticket, "provider_id" | "state">>,
  ) {
    return await this.dao.updateStateOrProvider(
      this.databaseClient.get(),
      id,
      values,
    );
  }
}
