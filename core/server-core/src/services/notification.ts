import { NotificationConfig } from "@noctf/api/config";
import { ServiceCradle } from "../index.ts";
import {
  AnnouncementUpdateEvent,
  NotificationQueueWebhookEvent,
  SubmissionUpdateEvent,
} from "@noctf/api/events";
import { EventItem } from "./event_bus.ts";
import { TeamFlag } from "../types/enums.ts";
import ky from "ky";
import Handlebars from "handlebars";
import TTLCache from "@isaacs/ttlcache";
import { OutgoingSolveWebhookGeneric } from "@noctf/api/datatypes";
import { ValidationError } from "../errors.ts";
import SingleValueCache from "../util/single_value_cache.ts";
import { AnnouncementDAO } from "../dao/announcement.ts";
import { bisectLeft } from "../util/arrays.ts";

type Props = Pick<
  ServiceCradle,
  | "logger"
  | "databaseClient"
  | "challengeService"
  | "configService"
  | "eventBusService"
  | "teamService"
  | "userService"
>;

const ANNOUNCEMENT_CACHE_SIZE = 1024;

export class NotificationService {
  private readonly client;
  private readonly logger;
  private readonly challengeService;
  private readonly configService;
  private readonly eventBusService;
  private readonly teamService;
  private readonly userService;
  private readonly announcementDAO;

  private readonly templateCache = new TTLCache<
    string,
    HandlebarsTemplateDelegate<any>
  >({
    max: 256,
    ttl: Infinity,
  });
  private readonly cached = new SingleValueCache(
    async () =>
      (await this.announcementDAO.query({}, ANNOUNCEMENT_CACHE_SIZE)).map(
        ({ visible_to, ...rest }) => ({
          ...rest,
          visible_to: new Set(visible_to),
        }),
      ),
    180000,
  );

  constructor({
    logger,
    databaseClient,
    challengeService,
    configService,
    eventBusService,
    teamService,
    userService,
  }: Props) {
    this.client = ky.create();
    this.logger = logger;
    this.challengeService = challengeService;
    this.configService = configService;
    this.eventBusService = eventBusService;
    this.teamService = teamService;
    this.userService = userService;
    this.announcementDAO = new AnnouncementDAO(databaseClient.get());
  }

  async init() {
    await this.configService.register(NotificationConfig, {}, (v) => {
      if (!v.submission) return;
      for (const item of v.submission) {
        if (item.type === "discord" && typeof item.template !== "string") {
          throw new ValidationError("Discord webhooks must have a template");
        }
      }
    });
  }

  async worker(signal: AbortSignal) {
    await Promise.all([
      this.eventBusService.subscribe<SubmissionUpdateEvent>(
        signal,
        "NotificationBloodWorker",
        [SubmissionUpdateEvent.$id!],
        {
          concurrency: 2,
          handler: (data) => this.handleSubmission(data),
        },
      ),
      this.eventBusService.subscribe<AnnouncementUpdateEvent>(
        signal,
        undefined,
        [AnnouncementUpdateEvent.$id!],
        {
          concurrency: 1,
          handler: (data) => this.handleAnnouncementCache(data),
        },
      ),
      this.eventBusService.subscribe<NotificationQueueWebhookEvent>(
        signal,
        "NotificationQueueWebhookWorker",
        [NotificationQueueWebhookEvent.$id!],
        {
          concurrency: 2,
          backoff: () => 20000 + Math.floor(Math.random() * 10000),
          handler: (data) => this.sendWebhook(data),
        },
      ),
    ]);
  }

  async getVisibleAnnouncements(
    visible_to?: string[],
    updated_at?: Date,
    limit?: number,
  ) {
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
      return this.announcementDAO.query({
        visible_to,
        updated_at: updated_at ? [new Date(0), updated_at] : undefined,
      });
    }
    return out;
  }

  private async handleAnnouncementCache(
    data: EventItem<AnnouncementUpdateEvent>,
  ) {
    const announcements = await this.cached.get();
    if (
      !announcements.length ||
      announcements[0].updated_at < data.data.updated_at
    ) {
      this.cached.clear();
    }
  }

  private async handleSubmission(data: EventItem<SubmissionUpdateEvent>) {
    const event = data.data;
    if (event.hidden) return;
    const { submission } = (await this.configService.get(NotificationConfig))
      ?.value;
    const enabled = submission?.filter(
      (b) =>
        b.enabled &&
        (!b.max_seq || event.seq <= b.max_seq) &&
        (!b.status_filter?.length || b.status_filter.includes(event.status)),
    );
    if (!enabled?.length) return;

    const [team, user, challenge] = await Promise.all([
      this.teamService.get(event.team_id),
      event.user_id ? this.userService.get(event.user_id) : undefined,
      this.challengeService.get(event.challenge_id, true),
    ]);
    if (team.flags.includes(TeamFlag.HIDDEN)) return;
    if (
      challenge.hidden ||
      (challenge.visible_at && challenge.visible_at > new Date())
    )
      return;

    for (const cfg of enabled) {
      if (!cfg.enabled) continue;
      if (
        cfg.division_ids &&
        cfg.division_ids.length &&
        !cfg.division_ids.includes(team.division_id)
      ) {
        continue;
      }
      switch (cfg.type) {
        case "discord":
          if (!cfg.template) {
            this.logger.warn(
              "Could not send discord message, template is not defined",
            );
            continue;
          }
          const template = this.getTemplateFunction(cfg.template);
          const content = template({
            user,
            team,
            challenge,
            event,
          });
          await this.eventBusService.publish(NotificationQueueWebhookEvent, {
            url: cfg.url,
            payload: { content },
          });
          break;
        case "webhook":
          await this.eventBusService.publish(NotificationQueueWebhookEvent, {
            url: cfg.url,
            payload: {
              challenge_id: challenge.id,
              challenge_title: challenge.title,
              team_id: team.id,
              team_name: team.name,
              user_id: user?.id || 0,
              user_name: user?.name || "",
              id: event.id,
              seq: event.seq,
              comments: event.comments,
              status: event.status,
              is_update: event.is_update,
              created_at: event.created_at,
              updated_at: event.updated_at,
            } as OutgoingSolveWebhookGeneric,
          });
          break;
      }
    }
  }

  private async sendWebhook(
    data: EventItem<{ payload: unknown; url: string }>,
  ) {
    await this.client.post(data.data.url, { json: data.data.payload });
  }

  private getTemplateFunction(template: string) {
    let tpl = this.templateCache.get(template);
    if (!tpl) {
      tpl = Handlebars.compile(template);
      this.templateCache.set(template, tpl);
    }
    return tpl;
  }
}
