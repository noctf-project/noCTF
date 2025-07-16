import TTLCache from "@isaacs/ttlcache";
import { AnnouncementDAO } from "../dao/announcement.ts";
import { ServiceCradle } from "../index.ts";
import SingleValueCache from "../util/single_value_cache.ts";
import { AuditParams } from "../types/audit_log.ts";
import { AnnouncementUpdateEvent } from "@noctf/api/events";
import { EventItem } from "./event_bus.ts";
import { EntityType } from "../types/enums.ts";
import { bisectLeft } from "../util/arrays.ts";
import { NotificationConfig } from "@noctf/api/config";
import { BadRequestError, ConflictError } from "../errors.ts";
import { LimitOffset } from "@noctf/api/datatypes";
import { FilterUndefined } from "../util/filter.ts";

type Props = Pick<
  ServiceCradle,
  | "auditLogService"
  | "databaseClient"
  | "challengeService"
  | "configService"
  | "eventBusService"
>;

const ANNOUNCEMENT_CACHE_SIZE = 1024;

export class AnnouncementService {
  private readonly auditLogService;
  private readonly configService;
  private readonly eventBusService;
  private readonly dao;

  private readonly cached = new SingleValueCache(
    async () =>
      (await this.dao.query({}, { limit: ANNOUNCEMENT_CACHE_SIZE })).map(
        ({ visible_to, ...rest }) => ({
          ...rest,
          visible_to: new Set(visible_to),
        }),
      ),
    180000,
  );

  constructor({
    auditLogService,
    databaseClient,
    configService,
    eventBusService,
  }: Props) {
    this.auditLogService = auditLogService;
    this.configService = configService;
    this.eventBusService = eventBusService;
    this.dao = new AnnouncementDAO(databaseClient.get());
    void this.subscribeUpdates();
  }

  private async subscribeUpdates() {
    await this.eventBusService.subscribe<AnnouncementUpdateEvent>(
      new AbortController().signal,
      undefined,
      [AnnouncementUpdateEvent.$id!],
      {
        concurrency: 1,
        handler: (data) => this.invalidateCache(data),
      },
    );
  }

  private async invalidateCache(data: EventItem<AnnouncementUpdateEvent>) {
    const announcements = await this.cached.get();
    if (
      !announcements.length ||
      announcements[0].updated_at < data.data.updated_at
    ) {
      this.cached.clear();
    }
  }

  async list(
    params?: Parameters<AnnouncementDAO["query"]>[0],
    limit?: LimitOffset,
  ) {
    return this.dao.query(params, limit);
  }

  async listCount(params?: Parameters<AnnouncementDAO["getCount"]>[0]) {
    return this.dao.getCount(params);
  }

  async getDeliveryChannels() {
    const config = await this.configService.get(NotificationConfig);
    const channels: string[] = [];
    if (config.value.announcement?.email) channels.push("email");
    for (const channel of Object.keys(
      config.value.announcement?.webhooks || {},
    )) {
      const hook = config.value.announcement?.webhooks?.[channel];
      if (hook?.enabled) channels.push(`webhook:${channel}`);
    }
    return channels;
  }

  async create(
    v: Parameters<AnnouncementDAO["create"]>[0],
    { actor, message }: AuditParams = {},
  ) {
    await this.validateDeliveryChannels(v.visible_to, v.delivery_channels);
    const result = await this.dao.create(v);
    await Promise.all([
      this.auditLogService.log({
        operation: "announcement.create",
        actor,
        data: message,
        entities: [`${EntityType.ANNOUNCEMENT}:${result.id}`],
      }),
      this.eventBusService.publish(AnnouncementUpdateEvent, {
        type: "create",
        ...result,
      }),
    ]);
    return result;
  }

  async update(
    id: number,
    updated_at: Date | undefined,
    v: Parameters<AnnouncementDAO["update"]>[1],
    { actor, message }: AuditParams = {},
  ) {
    const announcement = await this.dao.get(id);
    if (
      updated_at &&
      updated_at.getTime() !== announcement.updated_at.getTime()
    ) {
      throw new ConflictError(
        "The announcement has been updated by someone else",
      );
    }
    await this.validateDeliveryChannels(
      v.visible_to || announcement.visible_to,
      v.delivery_channels || announcement.delivery_channels,
    );
    const result = await this.dao.update(id, v);
    await Promise.all([
      this.auditLogService.log({
        operation: "announcement.update",
        actor,
        data: message,
        entities: [`${EntityType.ANNOUNCEMENT}:${id}`],
      }),
      this.eventBusService.publish(AnnouncementUpdateEvent, {
        ...announcement,
        updated_at: result.updated_at,
        type: "update",
      }),
    ]);
    return {
      ...announcement,
      ...FilterUndefined(v),
      updated_at: result.updated_at,
    };
  }

  async delete(
    id: number,
    updated_at?: Date,
    { actor, message }: AuditParams = {},
  ) {
    const result = await this.dao.delete(id, updated_at);
    await Promise.all([
      this.auditLogService.log({
        operation: "announcement.delete",
        actor,
        data: message,
        entities: [`${EntityType.ANNOUNCEMENT}:${id}`],
      }),
      this.eventBusService.publish(AnnouncementUpdateEvent, {
        ...result,
        updated_at: new Date(),
        type: "delete",
      }),
    ]);
  }

  async getVisible(visible_to?: string[], updated_at?: Date, limit?: number) {
    const announcements = await this.cached.get();
    const updated_time = updated_at?.getTime() || 0;
    let idx = updated_time
      ? bisectLeft(announcements, -updated_time, (v) => -v.updated_at.getTime())
      : announcements.length;
    if (updated_time === announcements[idx]?.updated_at.getTime()) {
      idx += 1;
    }
    const out = [];
    for (let i = 0; i < idx; i++) {
      if (
        !visible_to ||
        visible_to.some((item) => announcements[i].visible_to.has(item))
      ) {
        out.push(announcements[i]);
        if (limit && out.length === limit) return out;
      }
    }
    // if results returned is less than what we would expect, query the db
    if (announcements.length >= ANNOUNCEMENT_CACHE_SIZE) {
      return this.dao.query({
        visible_to,
        updated_at: updated_at ? [new Date(0), updated_at] : undefined,
      });
    }
    return out;
  }

  private async validateDeliveryChannels(
    visible_to: string[] | Set<string>,
    channels: string[],
  ) {
    const isPrivate = AnnouncementService.isPrivate(visible_to);
    const config = await this.configService.get(NotificationConfig);
    for (const channel of channels) {
      if (channel === "email") {
        if (config.value.announcement?.email) continue;
        throw new BadRequestError("email delivery is not enabled");
      }
      if (channel.startsWith("webhook:")) {
        if (isPrivate)
          throw new BadRequestError(
            "Private announcements may not be made to webhoooks",
          );
        const hook =
          config.value.announcement?.webhooks?.[channel.substring(8)];
        if (!hook || !hook.enabled)
          throw new BadRequestError(`${channel} delivery is not enabled`);
      }
    }
  }

  static isPrivate(visible_to: string[] | Set<string>) {
    const visible = Array.isArray(visible_to) ? visible_to : [...visible_to];
    return (
      !visible.length ||
      visible.some((x) => x.startsWith("team:") || x.startsWith("user:"))
    );
  }
}
