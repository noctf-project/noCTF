import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockDeep, DeepMockProxy } from "vitest-mock-extended";
import { ChallengeService } from "./index.ts";
import { ChallengeDAO } from "../../dao/challenge.ts";
import { SubmissionDAO } from "../../dao/submission.ts";
import { SubmissionLogDAO } from "../../dao/submission_log.ts";
import { DatabaseClient } from "../../clients/database.ts";
import { AuditLogService } from "../audit_log.ts";
import { EventBusService } from "../event_bus.ts";
import { FileService } from "../file/index.ts";
import { ScoreService } from "../score.ts";
import { Logger } from "../../types/primitives.ts";
import {
  BadRequestError,
  ConflictError,
  ValidationError,
} from "../../errors.ts";
import { ChallengeUpdateEvent, SubmissionUpdateEvent } from "@noctf/api/events";
import {
  Challenge,
  ChallengeMetadata,
  ChallengeSolveInputType,
  PublicChallenge,
} from "@noctf/api/datatypes";
import { Transaction } from "kysely";
import { DB } from "@noctf/schema";
import { ChallengePlugin } from "./types.ts";
import { ActorType } from "../../types/enums.ts";

vi.mock(import("../../dao/challenge.ts"));
vi.mock(import("../../dao/submission.ts"));
vi.mock(import("../../dao/submission_log.ts"));

const dummyPrivateMetadata = {
  solve: {
    source: "flag",
    flag: [
      {
        strategy: "case_sensitive",
        data: "flag{test}",
      },
    ],
  },
  score: {
    strategy: "core:static",
    params: { base: 100 },
  },
  files: [],
};

const dummyChallenge: Challenge = {
  id: 1,
  slug: "test-challenge",
  title: "Test Challenge",
  description: "Challenge Description",
  private_metadata: dummyPrivateMetadata,
  tags: {
    category: "crypto",
    "noctf:secret": "hide-me",
  },
  hidden: false,
  version: 1,
  visible_at: null,
  created_at: new Date(1000),
  updated_at: new Date(1000),
};

describe(ChallengeService, () => {
  let logger: DeepMockProxy<Logger>;
  let auditLogService: DeepMockProxy<AuditLogService>;
  let databaseClient: DeepMockProxy<DatabaseClient>;
  let eventBusService: DeepMockProxy<EventBusService>;
  let fileService: DeepMockProxy<FileService>;
  let scoreService: DeepMockProxy<ScoreService>;
  let challengeDAO: DeepMockProxy<ChallengeDAO>;
  let submissionDAO: DeepMockProxy<SubmissionDAO>;
  let submissionLogDAO: DeepMockProxy<SubmissionLogDAO>;
  let service: ChallengeService;

  beforeEach(() => {
    logger = mockDeep<Logger>();
    auditLogService = mockDeep<AuditLogService>();
    databaseClient = mockDeep<DatabaseClient>();
    eventBusService = mockDeep<EventBusService>();
    fileService = mockDeep<FileService>();
    scoreService = mockDeep<ScoreService>();
    scoreService.getExpr.mockResolvedValue({
      evaluate: () => 100,
    } as unknown as ReturnType<ScoreService["getExpr"]> extends Promise<infer R>
      ? R
      : never);
    challengeDAO = mockDeep<ChallengeDAO>();
    submissionDAO = mockDeep<SubmissionDAO>();
    submissionLogDAO = mockDeep<SubmissionLogDAO>();

    vi.mocked(ChallengeDAO).mockReturnValue(challengeDAO);
    vi.mocked(SubmissionDAO).mockReturnValue(submissionDAO);
    vi.mocked(SubmissionLogDAO).mockReturnValue(submissionLogDAO);

    const txMock = mockDeep<Transaction<DB>>();
    type TxArg = Parameters<
      Parameters<typeof databaseClient.transaction>[0]
    >[0];
    databaseClient.transaction.mockImplementation((async (
      cb: (tx: TxArg) => Promise<unknown>,
    ) => {
      return await cb(txMock as unknown as TxArg);
    }) as typeof databaseClient.transaction);

    service = new ChallengeService({
      logger,
      auditLogService,
      databaseClient,
      eventBusService,
      fileService,
      scoreService,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("plugin management", () => {
    it("disallows registering a plugin with an already registered name", () => {
      const duplicatePlugin = mockDeep<ChallengePlugin>();
      duplicatePlugin.name.mockReturnValue("core");

      expect(() => service.register(duplicatePlugin)).toThrow(
        "Plugin core has already been registered",
      );
    });

    it("allows registering custom plugin and exposes compiled private metadata schema", () => {
      const schema = service.getPrivateMetadataSchema();
      expect(schema).toBeDefined();
      expect(schema.type).toBe("object");
    });
  });

  describe("create", () => {
    it("throws ValidationError when private_metadata is invalid", async () => {
      await expect(
        service.create({
          slug: "bad-challenge",
          title: "Bad",
          description: "Bad desc",
          // missing score & files
          private_metadata: {
            solve: { source: "flag" },
          } as unknown as Challenge["private_metadata"],
          tags: {},
          hidden: false,
          visible_at: null,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("creates challenge, logs audit, and publishes ChallengeUpdateEvent", async () => {
      challengeDAO.create.mockResolvedValue(dummyChallenge);

      const result = await service.create(
        {
          slug: "test-challenge",
          title: "Test Challenge",
          description: "Challenge Description",
          private_metadata: dummyPrivateMetadata,
          tags: { category: "crypto" },
          hidden: false,
          visible_at: null,
        },
        { type: ActorType.USER, id: 42 },
      );

      expect(challengeDAO.create).toHaveBeenCalled();
      expect(auditLogService.log).toHaveBeenCalledWith({
        operation: "challenge.create",
        actor: { type: ActorType.USER, id: 42 },
        entities: ["challenge:1"],
      });
      expect(eventBusService.publish).toHaveBeenCalledWith(
        ChallengeUpdateEvent,
        expect.objectContaining({
          id: 1,
          slug: "test-challenge",
          version: 1,
          type: "create",
        }),
      );
      expect(result).toEqual(dummyChallenge);
    });
  });

  describe("update", () => {
    it("validates metadata if provided and updates challenge with audit log", async () => {
      challengeDAO.update.mockResolvedValue({
        version: 2,
        slug: "test-challenge",
        updated_at: new Date(2000),
        hidden: false,
      });

      const newVersion = await service.update(
        1,
        {
          title: "Updated Title",
          private_metadata: dummyPrivateMetadata,
        },
        { type: ActorType.USER, id: 42 },
      );

      expect(newVersion).toBe(2);
      expect(challengeDAO.update).toHaveBeenCalledWith(1, {
        title: "Updated Title",
        private_metadata: dummyPrivateMetadata,
      });
      expect(auditLogService.log).toHaveBeenCalledWith({
        operation: "challenge.update",
        actor: { type: ActorType.USER, id: 42 },
        entities: ["challenge:1"],
        data: "Updated to version 2",
      });
      expect(eventBusService.publish).toHaveBeenCalledWith(
        ChallengeUpdateEvent,
        expect.objectContaining({
          id: 1,
          slug: "test-challenge",
          version: 2,
          type: "update",
        }),
      );
    });
  });

  describe("get and list", () => {
    it("parses numeric string IDs properly in get", async () => {
      challengeDAO.get.mockResolvedValue(dummyChallenge);

      const res = await service.get("1");
      expect(challengeDAO.get).toHaveBeenCalledWith(1);
      expect(res).toEqual(dummyChallenge);
    });

    it("throws BadRequestError if slug does not match regex format", async () => {
      await expect(service.get("INVALID SLUG!")).rejects.toThrow(
        BadRequestError,
      );
    });

    it("queries by valid slug string", async () => {
      challengeDAO.get.mockResolvedValue(dummyChallenge);

      const res = await service.get("valid-slug");
      expect(challengeDAO.get).toHaveBeenCalledWith("valid-slug");
      expect(res).toEqual(dummyChallenge);
    });

    it("filters out noctf: prefixed tags when removePrivateTags is requested", async () => {
      const summaryItem: ChallengeMetadata = {
        id: 1,
        slug: "test-challenge",
        title: "Test Challenge",
        private_metadata: dummyPrivateMetadata,
        tags: {
          category: "crypto",
          "noctf:flag": "hidden",
        },
        hidden: false,
        visible_at: null,
        created_at: new Date(1000),
        updated_at: new Date(1000),
      };

      challengeDAO.list.mockResolvedValue([summaryItem]);

      const list = await service.list({}, { removePrivateTags: true });
      expect(list[0].tags).toEqual({
        category: "crypto",
      });
    });
  });

  describe("delete", () => {
    it("deletes challenge and publishes delete ChallengeUpdateEvent", async () => {
      challengeDAO.delete.mockResolvedValue({
        slug: "test-challenge",
        version: 2,
        updated_at: new Date(2000),
        hidden: false,
      });

      await service.delete(1);

      expect(challengeDAO.delete).toHaveBeenCalledWith(1);
      expect(eventBusService.publish).toHaveBeenCalledWith(
        ChallengeUpdateEvent,
        expect.objectContaining({
          id: 1,
          slug: "test-challenge",
          version: 3,
          type: "delete",
        }),
      );
    });
  });

  describe("solve", () => {
    it("throws ConflictError if an existing submission is already queued or solved", async () => {
      challengeDAO.get.mockResolvedValue(dummyChallenge);
      submissionDAO.getCurrentMetadata.mockResolvedValue({
        id: 10,
        user_id: 1,
        status: "correct",
        created_at: new Date(1000),
      });

      await expect(service.solve(1, 100, 10, "flag{test}")).rejects.toThrow(
        ConflictError,
      );
    });

    it("processes correct flag submission, records in db, and publishes SubmissionUpdateEvent", async () => {
      challengeDAO.get.mockResolvedValue(dummyChallenge);
      submissionDAO.getCurrentMetadata.mockResolvedValue(undefined);

      submissionDAO.create.mockResolvedValue({
        id: 99,
        created_at: new Date(2000),
        updated_at: new Date(2000),
        seq: 1,
      });

      const result = await service.solve(dummyChallenge, 100, 10, "flag{test}");

      expect(result).toEqual({
        status: "correct",
        created_at: new Date(2000),
      });

      expect(submissionDAO.create).toHaveBeenCalledWith(
        expect.objectContaining({
          challenge_id: 1,
          team_id: 100,
          user_id: 10,
          status: "correct",
          data: "flag{test}",
        }),
      );

      expect(submissionLogDAO.create).toHaveBeenCalledWith([
        expect.objectContaining({
          actor: "user:10",
          submission_id: 99,
          changes: { status: "correct", hidden: false, weight: 0 },
        }),
      ]);

      expect(eventBusService.publish).toHaveBeenCalledWith(
        SubmissionUpdateEvent,
        expect.objectContaining({
          id: 99,
          challenge_id: 1,
          team_id: 100,
          user_id: 10,
          status: "correct",
          seq: 2,
        }),
      );
    });
  });

  describe("getRendered", () => {
    it("renders public challenge stripping private flag details", async () => {
      challengeDAO.get.mockResolvedValue(dummyChallenge);

      const rendered: PublicChallenge = await service.getRendered(1);

      expect(rendered.id).toBe(1);
      expect(rendered.title).toBe("Test Challenge");
      expect(rendered.metadata.solve.input_type).toBe(
        ChallengeSolveInputType.Text,
      );
      expect(rendered).not.toHaveProperty("private_metadata");
    });
  });
});
