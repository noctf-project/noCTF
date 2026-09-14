import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockDeep, DeepMockProxy } from "vitest-mock-extended";
import { NotificationService } from "./notification.ts";
import { ConfigService } from "./config.ts";
import { EventBusService, EventItem } from "./event_bus.ts";
import { ChallengeService } from "./challenge/index.ts";
import { TeamService } from "./team.ts";
import { UserService } from "./user.ts";
import { TeamFlag } from "../types/enums.ts";
import { ValidationError } from "../errors.ts";
import { Logger } from "../types/primitives.ts";
import {
  AnnouncementUpdateEvent,
  NotificationQueueWebhookEvent,
  SubmissionUpdateEvent,
} from "@noctf/api/events";
import { Challenge, User } from "@noctf/api/datatypes";
import { NotificationConfig as NotificationConfigSchema } from "@noctf/api/config";
import { TTLCache } from "@isaacs/ttlcache";

type Submitted = (e: EventItem<SubmissionUpdateEvent>) => Promise<void>;
type Announced = (e: EventItem<AnnouncementUpdateEvent>) => Promise<void>;

describe(NotificationService, () => {
  let logger: DeepMockProxy<Logger>;
  let configService: DeepMockProxy<ConfigService>;
  let eventBusService: DeepMockProxy<EventBusService>;
  let challengeService: DeepMockProxy<ChallengeService>;
  let teamService: DeepMockProxy<TeamService>;
  let userService: DeepMockProxy<UserService>;
  let service: NotificationService;
  let handleSubmission: Submitted;
  let handleAnnouncement: Announced;

  const disc = {
    name: "Team1",
    bio: "",
    country: null,
    tag_ids: [],
    division_id: 1,
  };
  type TeamWithMembers = Awaited<ReturnType<TeamService["get"]>>;
  const team = {
    ...disc,
    id: 1,
    join_code: null,
    flags: [],
    created_at: new Date(),
    members: [],
  } as TeamWithMembers;
  const user: User = {
    id: 2,
    name: "alice",
    bio: "",
    country: null,
    flags: [],
    roles: [],
    created_at: new Date(),
  };
  const challenge: Challenge = {
    id: 99,
    slug: "pledge",
    title: "The Pledge",
    description: "",
    private_metadata: {} as Challenge["private_metadata"],
    tags: {},
    hidden: false,
    version: 1,
    visible_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const submissionEvent: EventItem<SubmissionUpdateEvent> = {
    id: 1,
    subject: "events.submission.update",
    timestamp: new Date(),
    attempt: 1,
    data: {
      id: 10,
      team_id: 1,
      user_id: 2,
      challenge_id: 99,
      hidden: false,
      created_at: new Date(1_234_567_000),
      updated_at: new Date(1_234_567_000),
      seq: 1,
      is_update: false,
      status: "correct",
    },
  };

  const setupConfig = {
    version: 1,
    value: {
      initialized: true,
      active: true,
      root_url: "https://example.com",
      name: "noCTF",
      flag_prefix: "noctf",
      start_time_s: 0,
      end_time_s: 4_102_444_800,
    },
  };

  beforeEach(() => {
    logger = mockDeep<Logger>();
    configService = mockDeep<ConfigService>();
    eventBusService = mockDeep<EventBusService>();
    challengeService = mockDeep<ChallengeService>();
    teamService = mockDeep<TeamService>();
    userService = mockDeep<UserService>();

    service = new NotificationService({
      logger,
      databaseClient: undefined as never,
      challengeService,
      configService,
      eventBusService,
      teamService,
      userService,
    });
    handleSubmission = (e) => service["handleSubmission"](e);
    handleAnnouncement = (e) => service["handleAnnouncement"](e);
    challengeService.get.mockResolvedValue(challenge);
    teamService.get.mockResolvedValue(team);
    userService.get.mockResolvedValue(user);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  describe("init", () => {
    it("registers NotificationConfig and validates discord submission templates", async () => {
      await service.init();
      expect(configService.register).toHaveBeenCalledWith(
        NotificationConfigSchema,
        {},
        expect.any(Function),
      );
    });

    it("throws ValidationError when a discord submission is missing a template", async () => {
      await service.init();
      const validator = configService.register.mock.calls[0][2] as (
        v: unknown,
      ) => void;
      expect(() =>
        validator({
          submission: [{ url: "https://x", type: "discord", enabled: true }],
        }),
      ).toThrow(ValidationError);
    });

    it("accepts valid announcement webhook templates", async () => {
      await service.init();
      const validator = configService.register.mock.calls[0][2] as (
        v: unknown,
      ) => void;
      expect(() =>
        validator({
          announcement: {
            webhooks: {
              discord: {
                url: "https://x",
                type: "discord",
                template: "{{title}}",
                enabled: true,
              },
            },
          },
        }),
      ).not.toThrow();
    });
  });

  describe("handleSubmission", () => {
    it("skips hidden submissions", async () => {
      await handleSubmission({
        ...submissionEvent,
        data: { ...submissionEvent.data, hidden: true },
      });
      expect(configService.get).not.toHaveBeenCalled();
      expect(eventBusService.publish).not.toHaveBeenCalled();
    });

    it("skips submissions outside the CTF time window", async () => {
      configService.get.mockResolvedValue({
        ...setupConfig,
        value: { ...setupConfig.value, start_time_s: 2_000_000_000 },
      });
      await handleSubmission(submissionEvent);
      expect(eventBusService.publish).not.toHaveBeenCalled();
    });

    it("skips hidden teams", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {
          submission: [
            {
              url: "https://example.com/hook",
              type: "discord",
              template: "{{team.name}}",
              enabled: true,
            },
          ],
        },
      });
      teamService.get.mockResolvedValue({
        ...team,
        flags: [TeamFlag.HIDDEN],
      });
      await handleSubmission(submissionEvent);
      expect(eventBusService.publish).not.toHaveBeenCalled();
    });

    it("skips disabled or division-filtered notification configs", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {
          submission: [
            {
              url: "https://example.com/hook",
              type: "discord",
              enabled: false,
            },
            {
              url: "https://example.com/hook",
              type: "webhook",
              enabled: true,
              division_ids: [42],
            },
          ],
        },
      });
      await handleSubmission(submissionEvent);
      expect(eventBusService.publish).not.toHaveBeenCalled();
    });

    it("publishes a rendered discord template", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {
          submission: [
            {
              url: "https://example.com/hook",
              type: "discord",
              template:
                "{{team.name}} solved {{challenge.title}} ({{user.name}})",
              enabled: true,
            },
          ],
        },
      });
      await handleSubmission(submissionEvent);

      expect(eventBusService.publish).toHaveBeenCalledWith(
        NotificationQueueWebhookEvent,
        {
          url: "https://example.com/hook",
          payload: {
            content: "Team1 solved The Pledge (alice)",
            allowed_mentions: { parse: [] },
          },
        },
      );
    });

    it("reuses the compiled template cache for repeated submissions", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {
          submission: [
            {
              url: "https://example.com/hook",
              type: "discord",
              template: "{{team.name}}",
              enabled: true,
            },
          ],
        },
      });
      const templateCache = (
        service as unknown as {
          templateCache: TTLCache<string, unknown>;
        }
      ).templateCache;
      const setSpy = vi.spyOn(templateCache, "set");

      await handleSubmission(submissionEvent);
      expect(setSpy).toHaveBeenCalledTimes(1);
      await handleSubmission(submissionEvent);
      expect(setSpy).toHaveBeenCalledTimes(1);
    });

    it("publishes a generic webhook payload", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {
          submission: [
            {
              url: "https://example.com/hook",
              type: "webhook",
              enabled: true,
            },
          ],
        },
      });
      await handleSubmission(submissionEvent);

      expect(eventBusService.publish).toHaveBeenCalledWith(
        NotificationQueueWebhookEvent,
        {
          url: "https://example.com/hook",
          payload: expect.objectContaining({
            challenge_id: 99,
            challenge_title: "The Pledge",
            team_id: 1,
            team_name: "Team1",
            user_id: 2,
            user_name: "alice",
            id: 10,
            seq: 1,
            status: "correct",
            is_update: false,
          }),
        },
      );
    });
  });

  describe("handleAnnouncement", () => {
    const announcementEvent: EventItem<AnnouncementUpdateEvent> = {
      id: 1,
      subject: "events.announcement.update",
      timestamp: new Date(),
      attempt: 1,
      data: {
        id: 1,
        title: "CTF Started",
        message: "Good luck",
        created_by: null,
        updated_by: null,
        visible_to: ["public"],
        created_at: new Date(),
        updated_at: new Date(),
        delivery_channels: ["webhook:discord"],
        important: false,
        version: 1,
        type: "update",
      },
    };

    it("ignores delete events", async () => {
      await handleAnnouncement({
        ...announcementEvent,
        data: { ...announcementEvent.data, type: "delete" },
      });
      expect(configService.get).not.toHaveBeenCalled();
      expect(eventBusService.publish).not.toHaveBeenCalled();
    });

    it("publishes a generic webhook for webhook channels", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {
          announcement: {
            webhooks: {
              webhook: {
                url: "https://example.com/hook",
                type: "webhook",
                enabled: true,
              },
            },
          },
        },
      });
      await handleAnnouncement({
        ...announcementEvent,
        data: {
          ...announcementEvent.data,
          delivery_channels: ["webhook:webhook"],
        },
      });

      expect(eventBusService.publish).toHaveBeenCalledWith(
        NotificationQueueWebhookEvent,
        {
          url: "https://example.com/hook",
          payload: { message: "Good luck", title: "CTF Started" },
        },
      );
    });

    it("publishes a rendered discord message for discord channels", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {
          announcement: {
            webhooks: {
              discord: {
                url: "https://example.com/hook",
                type: "discord",
                template: "# {{title}}\n{{message}}",
                enabled: true,
              },
            },
          },
        },
      });
      await handleAnnouncement(announcementEvent);

      expect(eventBusService.publish).toHaveBeenCalledWith(
        NotificationQueueWebhookEvent,
        {
          url: "https://example.com/hook",
          payload: {
            content: "# CTF Started\nGood luck",
            allowed_mentions: { parse: ["roles"] },
          },
        },
      );
    });
  });
});
