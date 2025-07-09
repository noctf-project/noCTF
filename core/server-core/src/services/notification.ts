import { NotificationConfig } from "@noctf/api/config";
import { ServiceCradle } from "../index.ts";
import {
  NotificationQueueDiscordEvent,
  NotificationQueueWebhookEvent,
  SubmissionUpdateEvent,
} from "@noctf/api/events";
import { EventItem } from "./event_bus.ts";
import { TeamFlag } from "../types/enums.ts";
import ky from "ky";
import Handlebars from "handlebars";
import TTLCache from "@isaacs/ttlcache";

type Props = Pick<
  ServiceCradle,
  | "challengeService"
  | "configService"
  | "eventBusService"
  | "teamService"
  | "userService"
>;

export class NotificationService {
  private readonly client;
  private readonly challengeService;
  private readonly configService;
  private readonly eventBusService;
  private readonly teamService;
  private readonly userService;

  private readonly templateCache = new TTLCache<
    string,
    HandlebarsTemplateDelegate<any>
  >({
    max: 256,
    ttl: Infinity,
  });

  constructor({
    challengeService,
    configService,
    eventBusService,
    teamService,
    userService,
  }: Props) {
    this.client = ky.create();
    this.challengeService = challengeService;
    this.configService = configService;
    this.eventBusService = eventBusService;
    this.teamService = teamService;
    this.userService = userService;
  }

  async init() {
    await this.configService.register(NotificationConfig, {});
  }

  async worker(signal: AbortSignal) {
    await Promise.all([
      this.eventBusService.subscribe<SubmissionUpdateEvent>(
        signal,
        "NotificationBloodWorker",
        [SubmissionUpdateEvent.$id!],
        {
          concurrency: 2,
          handler: (data) => this.handleBlood(data),
        },
      ),
      this.eventBusService.subscribe<
        NotificationQueueDiscordEvent | NotificationQueueWebhookEvent
      >(
        signal,
        "NotificationQueueWebhookWorker",
        [
          NotificationQueueDiscordEvent.$id!,
          NotificationQueueWebhookEvent.$id!,
        ],
        {
          concurrency: 2,
          handler: (data) => this.sendWebhook(data),
        },
      ),
    ]);
  }

  private async handleBlood(data: EventItem<SubmissionUpdateEvent>) {
    const event = data.data;
    if (event.hidden || event.status !== "correct") return;
    const { blood } = (await this.configService.get(NotificationConfig))?.value;
    const enabled = blood?.filter(
      (b) => b.enabled && (b.all || event.seq === 1),
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
      if (!cfg.all && event.seq !== 1) continue;
      if (
        cfg.division_ids &&
        cfg.division_ids.length &&
        !cfg.division_ids.includes(team.division_id)
      ) {
        continue;
      }
      switch (cfg.type) {
        case "discord":
          const template = this.getTemplateFunction(cfg.template);
          const content = template({
            user,
            team,
            challenge,
            event,
          });
          await this.eventBusService.publish(NotificationQueueDiscordEvent, {
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
              submission_id: event.id,
              submission_created_at: event.created_at,
            },
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
