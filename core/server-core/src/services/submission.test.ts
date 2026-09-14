import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockDeep, DeepMockProxy } from "vitest-mock-extended";
import { SubmissionService } from "./submission.ts";
import { DatabaseClient } from "../clients/database.ts";
import { EventBusService } from "./event_bus.ts";
import { AuditLogService } from "./audit_log.ts";
import { SubmissionDAO } from "../dao/submission.ts";
import { SubmissionWeightDAO } from "../dao/submission_weight.ts";
import { BadRequestError } from "../errors.ts";
import { SubmissionUpdateEvent } from "@noctf/api/events";
import { ActorType } from "../types/enums.ts";

import type { DB } from "@noctf/schema";
import type { Transaction } from "kysely";

vi.mock(import("../dao/submission.ts"));
vi.mock(import("../dao/submission_weight.ts"));

describe(SubmissionService, () => {
  let databaseClient: DeepMockProxy<DatabaseClient>;
  let eventBusService: DeepMockProxy<EventBusService>;
  let auditLogService: DeepMockProxy<AuditLogService>;
  let submissionDAO: DeepMockProxy<SubmissionDAO>;
  let submissionWeightDAO: DeepMockProxy<SubmissionWeightDAO>;
  let service: SubmissionService;

  beforeEach(() => {
    databaseClient = mockDeep<DatabaseClient>();
    eventBusService = mockDeep<EventBusService>();
    auditLogService = mockDeep<AuditLogService>();
    submissionDAO = mockDeep<SubmissionDAO>();
    submissionWeightDAO = mockDeep<SubmissionWeightDAO>();

    vi.mocked(SubmissionDAO).mockImplementation(function () {
      return submissionDAO;
    });
    vi.mocked(SubmissionWeightDAO).mockImplementation(function () {
      return submissionWeightDAO;
    });

    const txMock = mockDeep<Transaction<DB>>();
    databaseClient.transaction.mockImplementation(async (cb) => {
      return await cb(
        txMock as unknown as Parameters<
          Parameters<typeof databaseClient.transaction>[0]
        >[0],
      );
    });

    service = new SubmissionService({
      databaseClient,
      eventBusService,
      auditLogService,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("update", () => {
    const actor = { type: ActorType.USER, id: 1 };

    it("throws BadRequestError if duplicate submission IDs are provided", async () => {
      const submissions = [
        { id: 1, comment: "first", status: "correct" as const },
        { id: 1, comment: "duplicate", status: "incorrect" as const },
      ];

      await expect(service.update(submissions, actor)).rejects.toThrow(
        BadRequestError,
      );
    });

    it("throws BadRequestError if not all submissions could be updated", async () => {
      const submissions = [
        { id: 1, comment: "first", status: "correct" as const },
        { id: 2, comment: "second", status: "incorrect" as const },
      ];

      submissionDAO.updateSubmissions.mockResolvedValue([
        {
          id: 1,
          hidden: false,
          status: "correct",
          user_id: 10,
          team_id: 20,
          challenge_id: 30,
          created_at: new Date(1000),
          updated_at: new Date(2000),
          seq: 1,
        },
      ]);

      await expect(service.update(submissions, actor)).rejects.toThrow(
        "Not all submissions found, missing: 2",
      );
    });

    it("updates records, writes audit log, and publishes update events", async () => {
      const submissions = [
        { id: 1, comment: "good solve", status: "correct" as const },
        { id: 2, comment: "wrong flag", status: "incorrect" as const },
      ];

      const updatedSubmissions = [
        {
          id: 2,
          hidden: false,
          status: "incorrect" as const,
          user_id: 11,
          team_id: 21,
          challenge_id: 30,
          created_at: new Date(2000),
          updated_at: new Date(3000),
          seq: 0,
        },
        {
          id: 1,
          hidden: false,
          status: "correct" as const,
          user_id: 10,
          team_id: 20,
          challenge_id: 30,
          created_at: new Date(1000),
          updated_at: new Date(2000),
          seq: 1,
        },
      ];

      submissionDAO.updateSubmissions.mockResolvedValue(updatedSubmissions);

      const result = await service.update(submissions, actor);

      expect(submissionDAO.updateSubmissions).toHaveBeenCalledWith(submissions);
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "submission.update",
          entities: ["submission:2", "submission:1"],
          actor: { type: ActorType.USER, id: 1 },
        }),
      );
      const { data } = vi.mocked(auditLogService.log).mock.calls[0][0];
      expect(JSON.parse(data ?? "")).toEqual({
        changes: { status: "incorrect" },
        comment: "wrong flag",
      });

      // Result should be sorted by created_at ascending
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);

      // Should publish events
      expect(eventBusService.publishBatch).toHaveBeenCalledWith(
        SubmissionUpdateEvent,
        expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            status: "correct",
            seq: 2,
            is_update: true,
          }),
          expect.objectContaining({
            id: 2,
            status: "incorrect",
            seq: 0,
            is_update: true,
          }),
        ]),
      );
    });
  });

  describe("upsertWeightsForChallenge", () => {
    it("throws BadRequestError on duplicate team_id", async () => {
      const items = [
        { team_id: 1, weight: 100 },
        { team_id: 1, weight: 200 },
      ];

      await expect(service.upsertWeightsForChallenge(5, items)).rejects.toThrow(
        BadRequestError,
      );
    });

    it("upserts weights, records weight rows, and publishes update events", async () => {
      const items = [{ team_id: 1, weight: 100 }];

      submissionDAO.upsertWeights.mockResolvedValue([
        {
          id: 42,
          hidden: false,
          status: "correct",
          user_id: 5,
          team_id: 1,
          challenge_id: 10,
          created_at: new Date(1000),
          updated_at: new Date(2000),
          seq: 1,
        },
      ]);

      const result = await service.upsertWeightsForChallenge(10, items);

      expect(submissionDAO.upsertWeights).toHaveBeenCalledWith([
        { challenge_id: 10, team_id: 1, weight: 100 },
      ]);
      expect(submissionWeightDAO.create).toHaveBeenCalledWith([
        { challenge_id: 10, team_id: 1, weight: 100 },
      ]);
      expect(eventBusService.publishBatch).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(42);
    });
  });

  describe("listSummary & getCount", () => {
    it("delegates listSummary to DAO", async () => {
      submissionDAO.listSummary.mockResolvedValue([]);
      const params = { challenge_id: [1] };
      const limit = { limit: 10, offset: 0 };

      await service.listSummary(params, limit);
      expect(submissionDAO.listSummary).toHaveBeenCalledWith(params, limit);
    });

    it("delegates getCount to DAO", async () => {
      submissionDAO.getCount.mockResolvedValue(5);
      const params = { challenge_id: [1] };

      const count = await service.getCount(params);
      expect(count).toBe(5);
      expect(submissionDAO.getCount).toHaveBeenCalledWith(params);
    });
  });
});
