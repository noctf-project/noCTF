import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScoreboardWorker } from "./worker.ts";
import { DeepMockProxy, mockDeep } from "vitest-mock-extended";
import { DivisionDAO } from "../../dao/division.ts";
import { ScoreboardDataLoader } from "./loader.ts";
import { ScoreboardHistory } from "./history.ts";
import { AwardDAO } from "../../dao/award.ts";
import { SubmissionDAO } from "../../dao/submission.ts";
import { TeamDAO } from "../../dao/team.ts";
import { ConfigService } from "../config.ts";
import { ChallengeService } from "../challenge/index.ts";
import { ScoreService } from "../score.ts";
import { DatabaseClient } from "../../clients/database.ts";
import { RedisClientFactory } from "../../clients/redis.ts";
import { Logger } from "../../types/primitives.ts";
import { Expression } from "expr-eval";
import { ChallengePrivateMetadataBase } from "@noctf/api/datatypes";
import { EventBusService } from "../event_bus.ts";
import { ChallengeSolveEvent, ScoreboardTriggerEvent } from "@noctf/api/events";

vi.mock(import("../../dao/division.ts"));
vi.mock(import("../../dao/award.ts"));
vi.mock(import("../../dao/submission.ts"));
vi.mock(import("../../dao/team.ts"));
vi.mock(import("./loader.ts"));
vi.mock(import("./history.ts"));

describe(ScoreboardWorker, () => {
  let configService: DeepMockProxy<ConfigService>;
  let challengeService: DeepMockProxy<ChallengeService>;
  let scoreService: DeepMockProxy<ScoreService>;
  let databaseClient: DeepMockProxy<DatabaseClient>;
  let redisClientFactory: DeepMockProxy<RedisClientFactory>;
  let eventBusService: DeepMockProxy<EventBusService>;
  let logger: DeepMockProxy<Logger>;

  let scoreboardDataLoader: DeepMockProxy<ScoreboardDataLoader>;
  let scoreboardHistory: DeepMockProxy<ScoreboardHistory>;
  let divisionDAO: DeepMockProxy<DivisionDAO>;
  let teamDAO: DeepMockProxy<TeamDAO>;
  let submissionDAO: DeepMockProxy<SubmissionDAO>;
  let awardDAO: DeepMockProxy<AwardDAO>;

  let worker: ScoreboardWorker;

  beforeEach(() => {
    configService = mockDeep<ConfigService>();
    challengeService = mockDeep<ChallengeService>();
    scoreService = mockDeep<ScoreService>();
    databaseClient = mockDeep<DatabaseClient>();
    redisClientFactory = mockDeep<RedisClientFactory>();
    eventBusService = mockDeep<EventBusService>();
    logger = mockDeep<Logger>();

    scoreboardDataLoader = mockDeep<ScoreboardDataLoader>();
    scoreboardHistory = mockDeep<ScoreboardHistory>();
    divisionDAO = mockDeep<DivisionDAO>();
    teamDAO = mockDeep<TeamDAO>();
    submissionDAO = mockDeep<SubmissionDAO>();
    awardDAO = mockDeep<AwardDAO>();

    vi.mocked(ScoreboardDataLoader).mockImplementation(function () {
      return scoreboardDataLoader;
    });
    vi.mocked(ScoreboardHistory).mockImplementation(function () {
      return scoreboardHistory;
    });
    vi.mocked(DivisionDAO).mockImplementation(function () {
      return divisionDAO;
    });
    vi.mocked(TeamDAO).mockImplementation(function () {
      return teamDAO;
    });
    vi.mocked(SubmissionDAO).mockImplementation(function () {
      return submissionDAO;
    });
    vi.mocked(AwardDAO).mockImplementation(function () {
      return awardDAO;
    });

    worker = new ScoreboardWorker({
      configService,
      challengeService,
      scoreService,
      databaseClient,
      redisClientFactory,
      eventBusService,
      logger,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  describe("computeAndSaveScoreboards & commitDivisionForPointer", () => {
    const exprMock = mockDeep<Expression>();

    beforeEach(() => {
      exprMock.variables.mockReturnValue(["ctx.n"]);
      exprMock.simplify.mockReturnValue({
        evaluate: () => 100,
      } as unknown as Expression);
      scoreService.getExpr.mockResolvedValue(exprMock);

      divisionDAO.list.mockResolvedValue([
        {
          id: 1,
          name: "Default",
          slug: "default",
          description: "",
          is_visible: true,
          is_joinable: true,
          created_at: new Date(0),
        },
      ]);
      teamDAO.listForScoreboard.mockResolvedValue([
        { id: 10, division_id: 1, flags: [], tag_ids: [] },
      ]);
      challengeService.list.mockResolvedValue([
        {
          id: 100,
          slug: "chal-1",
          title: "Chal 1",
          hidden: false,
          visible_at: null,
          created_at: new Date(0),
          updated_at: new Date(0),
          tags: {},
          private_metadata: {
            score: { strategy: "dynamic", params: {} },
          } as unknown as ChallengePrivateMetadataBase,
        },
      ]);
    });

    it("skips non-latest snapshot if freeze_time_s has not yet occurred", async () => {
      const freezeTimeS = 1000;
      vi.setSystemTime(new Date(999 * 1000)); // Before freeze

      configService.get.mockResolvedValue({
        version: 1,
        value: { freeze_time_s: freezeTimeS },
      });
      scoreboardDataLoader.getPointers.mockResolvedValue({});
      submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
      awardDAO.getAllAwards.mockResolvedValue([]);

      await worker.computeAndSaveScoreboards();

      expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);
      expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledWith(
        1,
        expect.any(Number),
        expect.any(Array),
        expect.any(Map),
        "latest",
      );
      expect(scoreboardHistory.saveIteration).toHaveBeenCalledTimes(1);
    });

    it("computes and saves frozen snapshot when freeze_time_s is reached", async () => {
      const freezeTimeS = 1000;
      vi.setSystemTime(new Date(1005 * 1000)); // 5s after freeze

      configService.get.mockResolvedValue({
        version: 1,
        value: { freeze_time_s: freezeTimeS },
      });
      scoreboardDataLoader.getPointers.mockResolvedValue({
        latest: 900 * 1000,
      });

      submissionDAO.getSolvesForCalculation.mockResolvedValue([
        {
          id: 1,
          team_id: 10,
          challenge_id: 100,
          created_at: new Date(500 * 1000),
          updated_at: new Date(500 * 1000),
          user_id: 1,
          weight: 0,
          hidden: false,
          value: null,
        },
        {
          id: 2,
          team_id: 10,
          challenge_id: 100,
          created_at: new Date(1002 * 1000),
          updated_at: new Date(1002 * 1000),
          user_id: 1,
          weight: 0,
          hidden: false,
          value: null,
        },
      ]);
      awardDAO.getAllAwards.mockResolvedValue([]);

      await worker.computeAndSaveScoreboards();

      expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(2);

      expect(scoreboardDataLoader.saveIndexed).toHaveBeenNthCalledWith(
        1,
        1,
        1000 * 1000,
        expect.any(Array),
        expect.any(Map),
        "frozen",
      );

      const frozenScoreboard =
        scoreboardDataLoader.saveIndexed.mock.calls[0][2];
      for (const entry of frozenScoreboard) {
        expect(entry.updated_at.getTime()).toBeLessThanOrEqual(1000 * 1000);
        expect(entry.last_solve.getTime()).toBeLessThanOrEqual(1000 * 1000);
      }

      expect(scoreboardDataLoader.saveIndexed).toHaveBeenNthCalledWith(
        2,
        1,
        1002 * 1000,
        expect.any(Array),
        expect.any(Map),
        "latest",
      );

      expect(scoreboardHistory.saveIteration).toHaveBeenCalledTimes(1);
    });

    it("touches existing frozen snapshot without recomputing if already at targetVersion", async () => {
      const freezeTimeS = 1000;
      const freezeVersion = freezeTimeS * 1000;
      vi.setSystemTime(new Date(1010 * 1000));

      configService.get.mockResolvedValue({
        version: 1,
        value: { freeze_time_s: freezeTimeS },
      });

      scoreboardDataLoader.getPointers.mockResolvedValue({
        frozen: freezeVersion,
        latest: 1000 * 1000,
      });

      submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
      awardDAO.getAllAwards.mockResolvedValue([]);

      await worker.computeAndSaveScoreboards();

      expect(scoreboardDataLoader.touchDivision).toHaveBeenCalledWith(1, {
        frozen: freezeVersion,
      });

      expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);
      expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledWith(
        1,
        0,
        expect.any(Array),
        expect.any(Map),
        "latest",
      );
    });

    it("expires superseded versions with a 10s grace period if not pointed to by any pointer", async () => {
      vi.setSystemTime(new Date(1000 * 1000));
      configService.get.mockResolvedValue({
        version: 1,
        value: {},
      });

      scoreboardDataLoader.getPointers.mockResolvedValue({ latest: 500 });
      submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
      awardDAO.getAllAwards.mockResolvedValue([]);

      await worker.computeAndSaveScoreboards();

      expect(scoreboardDataLoader.expireVersions).toHaveBeenCalledWith(
        1,
        [500],
        10,
      );
    });

    it("does not expire superseded version early if still pointed to by another pointer", async () => {
      const freezeTimeS = 500;
      vi.setSystemTime(new Date(1000 * 1000));
      configService.get.mockResolvedValue({
        version: 1,
        value: { freeze_time_s: freezeTimeS },
      });

      scoreboardDataLoader.getPointers.mockResolvedValue({
        frozen: 500 * 1000,
        latest: 500 * 1000,
      });
      submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
      awardDAO.getAllAwards.mockResolvedValue([]);

      await worker.computeAndSaveScoreboards();

      expect(scoreboardDataLoader.expireVersions).not.toHaveBeenCalledWith(
        1,
        expect.arrayContaining([500 * 1000]),
        expect.any(Number),
      );
    });

    it("skips recalculating division and touches all active pointers when up to date", async () => {
      const freezeTimeS = 1000;
      vi.setSystemTime(new Date(1005 * 1000));
      configService.get.mockResolvedValue({
        version: 1,
        value: { freeze_time_s: freezeTimeS },
      });

      scoreboardDataLoader.getPointers.mockResolvedValue({
        latest: 1005 * 1000,
        frozen: 1000 * 1000,
      });

      // Set lastProcessedEventTime to 1005s so the division latest pointer (1005s) is seen as up to date
      (
        worker as unknown as { lastProcessedEventTime: Date }
      ).lastProcessedEventTime = new Date(1005 * 1000);

      await worker.computeAndSaveScoreboards();

      expect(scoreboardDataLoader.touchDivision).toHaveBeenCalledWith(1, {
        latest: 1005 * 1000,
        frozen: 1000 * 1000,
      });

      expect(submissionDAO.getSolvesForCalculation).not.toHaveBeenCalled();
      expect(scoreboardDataLoader.saveIndexed).not.toHaveBeenCalled();
    });

    it("does not skip division if freeze was changed retroactively", async () => {
      const newFreezeTimeS = 800;
      vi.setSystemTime(new Date(1000 * 1000));
      configService.get.mockResolvedValue({
        version: 1,
        value: { freeze_time_s: newFreezeTimeS },
      });

      scoreboardDataLoader.getPointers.mockResolvedValue({
        latest: 1000 * 1000,
        frozen: 900 * 1000,
      });
      submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
      awardDAO.getAllAwards.mockResolvedValue([]);

      await worker.computeAndSaveScoreboards();

      expect(submissionDAO.getSolvesForCalculation).toHaveBeenCalledWith(1);
      expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledWith(
        1,
        800 * 1000,
        expect.any(Array),
        expect.any(Map),
        "frozen",
      );
    });

    it("emits ChallengeSolveEvent for new solves when notified bitmap is present", async () => {
      vi.setSystemTime(new Date(1000 * 1000));
      configService.get.mockResolvedValue({
        version: 1,
        value: {},
      });
      scoreboardDataLoader.getPointers.mockResolvedValue({});

      // Return an empty buffer (representing initialized bitmap)
      const emptyBitmap = new (
        await import("roaring")
      ).default.RoaringBitmap32();
      scoreboardDataLoader.getNotifiedSolves.mockResolvedValue(
        emptyBitmap.serialize(false) as Buffer,
      );

      submissionDAO.getSolvesForCalculation.mockResolvedValue([
        {
          id: 42,
          team_id: 10,
          challenge_id: 100,
          created_at: new Date(500 * 1000),
          updated_at: new Date(500 * 1000),
          user_id: 1,
          weight: 0,
          hidden: false,
          value: null,
        },
      ]);
      awardDAO.getAllAwards.mockResolvedValue([]);

      await worker.computeAndSaveScoreboards();

      expect(eventBusService.publishBatch).toHaveBeenCalledTimes(1);
      expect(eventBusService.publishBatch).toHaveBeenCalledWith(
        ChallengeSolveEvent,
        [
          expect.objectContaining({
            id: 42,
            team_id: 10,
            challenge_id: 100,
            division_id: 1,
            seq: 1,
          }),
        ],
      );
      expect(scoreboardDataLoader.saveNotifiedSolves).toHaveBeenCalledWith(
        expect.any(Buffer),
      );
    });

    it("does not re-emit ChallengeSolveEvent if solve was already notified", async () => {
      vi.setSystemTime(new Date(1000 * 1000));
      configService.get.mockResolvedValue({
        version: 1,
        value: {},
      });
      scoreboardDataLoader.getPointers.mockResolvedValue({});

      // Bitmap already has solve id 42
      const bitmap = new (await import("roaring")).default.RoaringBitmap32();
      bitmap.add(42);
      scoreboardDataLoader.getNotifiedSolves.mockResolvedValue(
        bitmap.serialize(false) as Buffer,
      );

      submissionDAO.getSolvesForCalculation.mockResolvedValue([
        {
          id: 42,
          team_id: 10,
          challenge_id: 100,
          created_at: new Date(500 * 1000),
          updated_at: new Date(500 * 1000),
          user_id: 1,
          weight: 0,
          hidden: false,
          value: null,
        },
      ]);
      awardDAO.getAllAwards.mockResolvedValue([]);

      await worker.computeAndSaveScoreboards();

      expect(eventBusService.publishBatch).not.toHaveBeenCalled();
      expect(scoreboardDataLoader.saveNotifiedSolves).not.toHaveBeenCalled();
    });

    it("updates watermark to max and clears notified solves bitmap when recomputing full graph", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {},
      });
      divisionDAO.list.mockResolvedValue([
        {
          id: 1,
          name: "Default",
          slug: "default",
          description: "",
          is_visible: true,
          is_joinable: true,
          created_at: new Date(0),
        },
      ]);
      teamDAO.listForScoreboard.mockResolvedValue([
        { id: 10, division_id: 1, tag_ids: [], flags: [] },
      ]);
      submissionDAO.getSolvesForCalculation.mockResolvedValue([
        {
          id: 42,
          team_id: 10,
          challenge_id: 100,
          created_at: new Date(2000 * 1000),
          updated_at: new Date(2000 * 1000),
          user_id: 1,
          weight: 0,
          hidden: false,
          value: null,
        },
      ]);
      awardDAO.getAllAwards.mockResolvedValue([]);

      await worker.recomputeFullGraph(new Date(2000 * 1000));

      expect(
        (
          worker as unknown as { lastProcessedEventTime: Date }
        ).lastProcessedEventTime.getTime(),
      ).toBe(2000 * 1000);
      // Events should not be emitted due to dryRun
      expect(eventBusService.publishBatch).not.toHaveBeenCalled();
      // Notified solves bitmap is populated with solve id 42 and saved
      const map = (
        worker as unknown as {
          notifiedSolves: import("roaring").default.RoaringBitmap32;
        }
      ).notifiedSolves;
      expect(map.has(42)).toBe(true);
      expect(scoreboardDataLoader.saveNotifiedSolves).toHaveBeenCalledWith(
        expect.any(Buffer),
      );

      // Subsequent compute must NOT emit events for the solves that were already captured
      eventBusService.publishBatch.mockClear();
      await worker.computeAndSaveScoreboards();
      expect(eventBusService.publishBatch).not.toHaveBeenCalled();
    });

    it("recomputes divisions and pointers during recomputeFullGraph even if already up to date with no pending events", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {},
      });
      divisionDAO.list.mockResolvedValue([
        {
          id: 1,
          name: "Default",
          slug: "default",
          description: "",
          is_visible: true,
          is_joinable: true,
          created_at: new Date(0),
        },
      ]);
      teamDAO.listForScoreboard.mockResolvedValue([
        { id: 10, division_id: 1, tag_ids: [], flags: [] },
      ]);
      submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
      awardDAO.getAllAwards.mockResolvedValue([]);

      // Current pointer version is already 5000, lastProcessedEventTime is 5000 (up to date)
      scoreboardDataLoader.getPointers.mockResolvedValue({ latest: 5000 });
      (
        worker as unknown as { lastProcessedEventTime: Date }
      ).lastProcessedEventTime = new Date(5000);

      // Normal computeAndSaveScoreboards with no eventTimestamp or older timestamp would skip it
      await worker.computeAndSaveScoreboards();
      expect(scoreboardDataLoader.saveIndexed).not.toHaveBeenCalled();

      // But recomputeFullGraph must force recalculation of divisions and pointers
      await worker.recomputeFullGraph();
      expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);
      expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledWith(
        1,
        expect.any(Number),
        expect.any(Array),
        expect.any(Map),
        "latest",
      );
    });

    it("recalculates when a newer eventTimestamp arrives and skips when timestamp is older or equal", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {},
      });
      divisionDAO.list.mockResolvedValue([
        {
          id: 1,
          name: "Default",
          slug: "default",
          description: "",
          is_visible: true,
          is_joinable: true,
          created_at: new Date(0),
        },
      ]);
      teamDAO.listForScoreboard.mockResolvedValue([
        { id: 10, division_id: 1, tag_ids: [], flags: [] },
      ]);
      submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
      awardDAO.getAllAwards.mockResolvedValue([]);

      // Start with latest pointer already set
      scoreboardDataLoader.getPointers.mockResolvedValue({ latest: 1000 });
      (
        worker as unknown as { lastProcessedEventTime: Date }
      ).lastProcessedEventTime = new Date(1000);

      // Event arrives with newer timestamp 2000 -> must recalculate
      await worker.computeAndSaveScoreboards(new Date(2000));
      expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);
      expect(
        (
          worker as unknown as { lastProcessedEventTime: Date }
        ).lastProcessedEventTime.getTime(),
      ).toBe(2000);

      scoreboardDataLoader.saveIndexed.mockClear();

      // Subsequent event with same or older timestamp -> skips
      await worker.computeAndSaveScoreboards(new Date(2000));
      expect(scoreboardDataLoader.saveIndexed).not.toHaveBeenCalled();

      // Periodic sweep (no eventTimestamp) -> skips because all pointers exist
      await worker.computeAndSaveScoreboards();
      expect(scoreboardDataLoader.saveIndexed).not.toHaveBeenCalled();
    });
  });

  describe("start & lifecycle", () => {
    it("serializes periodic and event-triggered calculations", async () => {
      let handler: ((data: unknown) => Promise<void>) | undefined;
      eventBusService.subscribe.mockImplementation(
        async (signal, _name, _subjects, opts) => {
          handler = opts.handler as (data: unknown) => Promise<void>;
          await new Promise<void>((resolve) =>
            signal.addEventListener("abort", () => resolve(), { once: true }),
          );
        },
      );

      const firstCalculation = Promise.withResolvers<void>();
      const compute = vi
        .spyOn(worker, "computeAndSaveScoreboards")
        .mockReturnValueOnce(firstCalculation.promise)
        .mockResolvedValue(undefined);
      const controller = new AbortController();
      const startPromise = worker.start(controller.signal);

      await vi.waitFor(() => expect(compute).toHaveBeenCalledTimes(1));
      const eventCalculation = handler!({
        subject: ScoreboardTriggerEvent.$id,
        timestamp: new Date(1000),
        data: {},
      });

      await Promise.resolve();
      expect(compute).toHaveBeenCalledTimes(1);

      firstCalculation.resolve();
      await eventCalculation;
      expect(compute).toHaveBeenCalledTimes(2);

      controller.abort();
      await startPromise;
    });

    it("drains an active calculation before propagating subscription failure", async () => {
      const subscription = Promise.withResolvers<void>();
      eventBusService.subscribe.mockReturnValue(subscription.promise);

      const calculation = Promise.withResolvers<void>();
      const compute = vi
        .spyOn(worker, "computeAndSaveScoreboards")
        .mockReturnValue(calculation.promise);
      const startPromise = worker.start(new AbortController().signal);

      await vi.waitFor(() => expect(compute).toHaveBeenCalledTimes(1));
      subscription.reject(new Error("subscription failed"));

      let settled = false;
      void startPromise.catch(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(false);

      calculation.resolve();
      await expect(startPromise).rejects.toThrow("subscription failed");
    });

    it("drains an active calculation before stopping on caller cancellation", async () => {
      eventBusService.subscribe.mockImplementation(
        async (signal) =>
          await new Promise<void>((resolve) =>
            signal.addEventListener("abort", () => resolve(), { once: true }),
          ),
      );

      const calculation = Promise.withResolvers<void>();
      const compute = vi
        .spyOn(worker, "computeAndSaveScoreboards")
        .mockReturnValue(calculation.promise);
      const controller = new AbortController();
      const startPromise = worker.start(controller.signal);

      await vi.waitFor(() => expect(compute).toHaveBeenCalledTimes(1));
      controller.abort();

      let settled = false;
      void startPromise.then(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(false);

      calculation.resolve();
      await startPromise;
    });

    it("cancels queued calculations when the leader session stops", async () => {
      let handler: ((data: unknown) => Promise<void>) | undefined;
      eventBusService.subscribe.mockImplementation(
        async (signal, _name, _subjects, opts) => {
          handler = opts.handler as (data: unknown) => Promise<void>;
          await new Promise<void>((resolve) =>
            signal.addEventListener("abort", () => resolve(), { once: true }),
          );
        },
      );

      const firstCalculation = Promise.withResolvers<void>();
      const compute = vi
        .spyOn(worker, "computeAndSaveScoreboards")
        .mockReturnValueOnce(firstCalculation.promise)
        .mockResolvedValue(undefined);
      const controller = new AbortController();
      const startPromise = worker.start(controller.signal);

      await vi.waitFor(() => expect(compute).toHaveBeenCalledTimes(1));
      const eventCalculation = handler!({
        subject: ScoreboardTriggerEvent.$id,
        timestamp: new Date(1000),
        data: {},
      });
      await Promise.resolve();

      controller.abort();
      firstCalculation.resolve();

      await eventCalculation;
      await startPromise;
      expect(compute).toHaveBeenCalledTimes(1);
    });

    it("runs leader session and sets up event subscription", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {},
      });
      divisionDAO.list.mockResolvedValue([]);

      const controller = new AbortController();
      eventBusService.subscribe.mockImplementation(async (_signal) => {
        // As soon as subscribe is called, abort the controller to let start() complete
        controller.abort();
      });

      await worker.start(controller.signal);

      expect(eventBusService.subscribe).toHaveBeenCalledWith(
        expect.any(AbortSignal),
        "ScoreboardWorker",
        expect.any(Array),
        expect.objectContaining({ concurrency: 1 }),
      );
    });

    it("fetches latest SQL activity timestamp on ScoreboardTriggerEvent", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {},
      });
      divisionDAO.list.mockResolvedValue([]);
      submissionDAO.getLatestActivityTimestamp.mockResolvedValue(
        new Date(5000),
      );

      let handler: ((data: unknown) => Promise<void>) | undefined;
      eventBusService.subscribe.mockImplementation(
        async (_signal, _name, _subjects, opts) => {
          handler = opts.handler as (data: unknown) => Promise<void>;
        },
      );

      const controller = new AbortController();
      const startPromise = worker.start(controller.signal);

      expect(handler).toBeDefined();

      // Trigger ScoreboardTriggerEvent
      await handler!({
        subject: ScoreboardTriggerEvent.$id,
        timestamp: new Date(1000),
        data: {},
      });

      expect(submissionDAO.getLatestActivityTimestamp).toHaveBeenCalled();
      expect(
        (
          worker as unknown as { lastProcessedEventTime: Date }
        ).lastProcessedEventTime.getTime(),
      ).toBe(5000);

      controller.abort();
      await startPromise;
    });

    it("periodic sweep picks up dropped events via SQL timestamp", async () => {
      configService.get.mockResolvedValue({
        version: 1,
        value: {},
      });
      divisionDAO.list.mockResolvedValue([
        {
          id: 1,
          name: "Default",
          slug: "default",
          description: "",
          is_visible: true,
          is_joinable: true,
          created_at: new Date(0),
        },
      ]);
      teamDAO.listForScoreboard.mockResolvedValue([
        { id: 10, division_id: 1, tag_ids: [], flags: [] },
      ]);
      challengeService.list.mockResolvedValue([]);
      submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
      awardDAO.getAllAwards.mockResolvedValue([]);
      scoreboardDataLoader.getPointers.mockResolvedValue({ latest: 1000 });

      // Worker already processed up to 1000
      (
        worker as unknown as { lastProcessedEventTime: Date }
      ).lastProcessedEventTime = new Date(1000);

      // SQL shows a newer solve at 3000 that was dropped by NATS
      submissionDAO.getLatestActivityTimestamp.mockResolvedValue(
        new Date(3000),
      );

      eventBusService.subscribe.mockImplementation(
        async (signal) =>
          await new Promise<void>((resolve) =>
            signal.addEventListener("abort", () => resolve(), { once: true }),
          ),
      );
      const controller = new AbortController();
      const startPromise = worker.start(controller.signal);

      await vi.waitFor(() =>
        expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1),
      );

      expect(submissionDAO.getLatestActivityTimestamp).toHaveBeenCalledTimes(1);
      expect(
        (
          worker as unknown as { lastProcessedEventTime: Date }
        ).lastProcessedEventTime.getTime(),
      ).toBe(3000);

      controller.abort();
      await startPromise;
    });
  });
});
