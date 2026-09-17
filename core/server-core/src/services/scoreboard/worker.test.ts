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
import {
  ChallengeSolveEvent,
  ChallengeUpdateEvent,
  ConfigUpdateEvent,
  ScoreboardTriggerEvent,
  TeamUpdateEvent,
} from "@noctf/api/events";
import roaring from "roaring";

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
    vi.setSystemTime(new Date(1000 * 1000));
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
    scoreboardDataLoader.hasTeamTags.mockResolvedValue(true);
    teamDAO.listForScoreboard.mockResolvedValue([]);

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
          updated_at: new Date(1003 * 1000),
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
        expect(entry.updated_at.getTime()).toBe(1000 * 1000);
        expect(entry.last_solve.getTime()).toBeLessThanOrEqual(1000 * 1000);
      }

      expect(scoreboardDataLoader.saveIndexed).toHaveBeenNthCalledWith(
        2,
        1,
        1005 * 1000,
        expect.any(Array),
        expect.any(Map),
        "latest",
      );

      expect(scoreboardHistory.saveIteration.mock.calls).toEqual([
        [1, frozenScoreboard, [], true],
        [1, scoreboardDataLoader.saveIndexed.mock.calls[1][2], []],
      ]);
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
        1010 * 1000,
        expect.any(Array),
        expect.any(Map),
        "latest",
      );
      expect(scoreboardHistory.saveIteration.mock.calls).toEqual([
        [1, scoreboardDataLoader.saveIndexed.mock.calls[0][2], []],
      ]);
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

    it("recalculates on a newer SQL timestamp and skips ordinary polls with older, equal, or absent timestamps", async () => {
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

      // A poll with newer SQL activity must recalculate.
      await worker.computeAndSaveScoreboards(new Date(2000));
      expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);
      expect(
        (
          worker as unknown as { lastProcessedEventTime: Date }
        ).lastProcessedEventTime.getTime(),
      ).toBe(2000);

      scoreboardDataLoader.saveIndexed.mockClear();

      // Ordinary polls with the same or older SQL activity skip.
      await worker.computeAndSaveScoreboards(new Date(2000));
      await worker.computeAndSaveScoreboards(new Date(1000));
      expect(scoreboardDataLoader.saveIndexed).not.toHaveBeenCalled();

      // Periodic sweep (no eventTimestamp) -> skips because all pointers exist
      await worker.computeAndSaveScoreboards();
      expect(scoreboardDataLoader.saveIndexed).not.toHaveBeenCalled();
    });

    describe("invalidation and publication regressions", () => {
      let pointers: Record<string, number>;
      const sqlTimestamp = new Date(500 * 1000);
      const metadataEvents = [
        {
          subject: TeamUpdateEvent.$id!,
          data: {
            id: 10,
            division_id: 1,
            flags: [],
            type: "update",
            updated_at: sqlTimestamp,
          },
        },
        {
          subject: ChallengeUpdateEvent.$id!,
          data: {
            id: 100,
            slug: "chal-1",
            version: 2,
            type: "update",
            updated_at: sqlTimestamp,
          },
        },
      ];
      const routineEvents = [
        { subject: ScoreboardTriggerEvent.$id!, data: {} },
        ...metadataEvents,
      ];
      const solve = {
        id: 42,
        team_id: 10,
        challenge_id: 100,
        created_at: sqlTimestamp,
        updated_at: sqlTimestamp,
        user_id: 1,
        weight: 0,
        hidden: false,
        value: null,
      };

      beforeEach(() => {
        configService.get.mockResolvedValue({ version: 1, value: {} });
        submissionDAO.getLatestActivityTimestamp.mockResolvedValue(
          sqlTimestamp,
        );
        submissionDAO.getSolvesForCalculation.mockResolvedValue([solve]);
        awardDAO.getAllAwards.mockResolvedValue([]);
        pointers = {};
        scoreboardDataLoader.getPointers.mockImplementation(async () => ({
          ...pointers,
        }));
        scoreboardDataLoader.saveIndexed.mockImplementation(
          async (division_id, version, _scoreboard, _challenges, pointer) => {
            if (pointer) pointers[pointer] = version;
            return { division_id, version };
          },
        );
        eventBusService.subscribe.mockImplementation(
          async (signal) =>
            await new Promise<void>((resolve) =>
              signal.addEventListener("abort", () => resolve(), { once: true }),
            ),
        );
      });

      describe("shared team tag refresh", () => {
        it.each([
          { teams: [] },
          {
            teams: [
              { id: 10, division_id: 1, flags: [], tag_ids: [1] },
              { id: 20, division_id: 2, flags: ["hidden"], tag_ids: [2] },
            ],
          },
        ])(
          "initializes tags on startup even when scores are skipped ($teams)",
          async ({ teams }) => {
            vi.useFakeTimers();
            teamDAO.listForScoreboard.mockResolvedValue(teams);
            submissionDAO.getLatestActivityTimestamp.mockResolvedValue(
              new Date(0),
            );
            pointers.latest = Date.now();
            const compute = vi.spyOn(worker, "computeAndSaveScoreboards");
            const controller = new AbortController();
            const startPromise = worker.start(controller.signal);
            try {
              await vi.advanceTimersByTimeAsync(0);
              expect(compute).toHaveResolvedTimes(1);
              expect(scoreboardDataLoader.saveTeamTags.mock.calls).toEqual([
                [teams],
              ]);
              expect(teamDAO.listForScoreboard).toHaveBeenCalledTimes(1);
              expect(scoreboardDataLoader.touchDivision).toHaveBeenCalledWith(
                1,
                pointers,
              );
              expect(scoreboardDataLoader.saveIndexed).not.toHaveBeenCalled();
              expect(
                submissionDAO.getSolvesForCalculation,
              ).not.toHaveBeenCalled();
              expect(challengeService.list).not.toHaveBeenCalled();

              await vi.advanceTimersByTimeAsync(60 * 1000);
              expect(compute).toHaveResolvedTimes(2);
              expect(scoreboardDataLoader.hasTeamTags).toHaveBeenCalled();
              expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(
                1,
              );
              expect(teamDAO.listForScoreboard).toHaveBeenCalledTimes(1);
              expect(scoreboardDataLoader.saveIndexed).not.toHaveBeenCalled();
            } finally {
              controller.abort();
              await startPromise;
            }
          },
        );

        it("recalculates ordinary solves without rewriting tags and reuses startup teams", async () => {
          await worker.computeAndSaveScoreboards(sqlTimestamp);
          expect(teamDAO.listForScoreboard).toHaveBeenCalledTimes(1);
          expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(1);

          const timestamp = new Date(sqlTimestamp.getTime() + 1000);
          submissionDAO.getSolvesForCalculation.mockResolvedValue([
            { ...solve, id: 43, created_at: timestamp, updated_at: timestamp },
          ]);
          await worker.computeAndSaveScoreboards(timestamp);

          expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(2);
          expect(
            scoreboardDataLoader.saveIndexed.mock.lastCall![2][0].solves,
          ).toEqual([expect.objectContaining({ id: 43 })]);
          expect(teamDAO.listForScoreboard).toHaveBeenCalledTimes(2);
          expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(1);
          expect(scoreboardDataLoader.hasTeamTags).toHaveBeenCalledTimes(1);
        });

        it("refreshes all divisions for a team event queued during an in-flight tag save", async () => {
          const [division] = await divisionDAO.list();
          divisionDAO.list.mockResolvedValue([
            division,
            { ...division, id: 2, name: "Other", slug: "other" },
          ]);
          const initialTeams = [
            { id: 10, division_id: 1, flags: [], tag_ids: [1] },
            { id: 20, division_id: 2, flags: [], tag_ids: [2] },
          ];
          const updatedTeams = [
            { id: 10, division_id: 2, flags: [], tag_ids: [3] },
            { id: 20, division_id: 2, flags: ["hidden"], tag_ids: [2] },
            { id: 30, division_id: 1, flags: [], tag_ids: [] },
          ];
          teamDAO.listForScoreboard.mockResolvedValue(initialTeams);
          submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
          const firstSave = Promise.withResolvers<void>();
          scoreboardDataLoader.saveTeamTags.mockReturnValueOnce(
            firstSave.promise,
          );
          const controller = new AbortController();
          const startPromise = worker.start(controller.signal);
          try {
            await vi.waitFor(() =>
              expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(
                1,
              ),
            );
            teamDAO.listForScoreboard.mockResolvedValue(updatedTeams);
            vi.setSystemTime(Date.now() + 1000);
            const handler = eventBusService.subscribe.mock.calls[0][3].handler;
            const eventCalculation = handler({
              subject: TeamUpdateEvent.$id!,
              timestamp: new Date(Date.now()),
              data: {
                id: 10,
                division_id: 2,
                flags: [],
                type: "update",
                updated_at: sqlTimestamp,
              },
            } as Parameters<typeof handler>[0]);
            await Promise.resolve();
            expect(teamDAO.listForScoreboard).toHaveBeenCalledTimes(1);

            firstSave.resolve();
            await eventCalculation;

            expect(scoreboardDataLoader.saveTeamTags.mock.calls).toEqual([
              [initialTeams],
              [updatedTeams],
            ]);
            expect(teamDAO.listForScoreboard).toHaveBeenCalledTimes(2);
            expect(
              scoreboardDataLoader.saveIndexed.mock.calls.map(
                (call) => call[0],
              ),
            ).toEqual([1, 2, 1, 2]);
            expect(
              scoreboardDataLoader.saveIndexed.mock.calls[2][2].map(
                (entry) => entry.team_id,
              ),
            ).toEqual([30]);
            expect(
              scoreboardDataLoader.saveIndexed.mock.calls[3][2]
                .map((entry) => entry.team_id)
                .sort(),
            ).toEqual([10, 20]);

            await worker.computeAndSaveScoreboards(sqlTimestamp);
            expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(2);
            expect(teamDAO.listForScoreboard).toHaveBeenCalledTimes(2);
          } finally {
            firstSave.resolve();
            controller.abort();
            await startPromise;
          }
        });

        it("rebuilds a missing index with unchanged SQL activity without recomputing scores", async () => {
          await worker.computeAndSaveScoreboards(sqlTimestamp);
          const updatedTeams = [
            { id: 10, division_id: 1, flags: [], tag_ids: [3] },
            { id: 20, division_id: 2, flags: [], tag_ids: [4] },
          ];
          teamDAO.listForScoreboard.mockResolvedValue(updatedTeams);
          scoreboardDataLoader.hasTeamTags.mockResolvedValueOnce(false);

          await worker.computeAndSaveScoreboards(sqlTimestamp);

          expect(scoreboardDataLoader.hasTeamTags).toHaveBeenCalledTimes(1);
          expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(2);
          expect(scoreboardDataLoader.saveTeamTags).toHaveBeenLastCalledWith(
            updatedTeams,
          );
          expect(teamDAO.listForScoreboard).toHaveBeenCalledTimes(2);
          expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);
          expect(submissionDAO.getSolvesForCalculation).toHaveBeenCalledTimes(
            1,
          );
          expect(challengeService.list).toHaveBeenCalledTimes(1);
          expect(scoreboardDataLoader.touchDivision).toHaveBeenCalledWith(
            1,
            pointers,
          );

          await worker.computeAndSaveScoreboards(sqlTimestamp);
          expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(2);
          expect(teamDAO.listForScoreboard).toHaveBeenCalledTimes(2);
        });

        it.each(["startup", "periodic"])(
          "retries a failed %s tag save on the next poll",
          async (refresh) => {
            if (refresh === "periodic") {
              await worker.computeAndSaveScoreboards(sqlTimestamp);
              vi.setSystemTime(Date.now() + 10 * 60 * 1000);
            }
            scoreboardDataLoader.saveTeamTags.mockClear();
            scoreboardDataLoader.saveIndexed.mockClear();
            teamDAO.listForScoreboard.mockClear();
            const error = new Error("tag save failed");
            scoreboardDataLoader.saveTeamTags.mockRejectedValueOnce(error);

            await expect(
              worker.computeAndSaveScoreboards(sqlTimestamp),
            ).rejects.toThrow(error);
            expect(scoreboardDataLoader.saveIndexed).not.toHaveBeenCalled();

            vi.setSystemTime(Date.now() + 60 * 1000);
            await worker.computeAndSaveScoreboards(sqlTimestamp);
            expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(2);
            expect(scoreboardDataLoader.saveTeamTags.mock.calls[1]).toEqual(
              scoreboardDataLoader.saveTeamTags.mock.calls[0],
            );
            expect(teamDAO.listForScoreboard).toHaveBeenCalledTimes(2);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);

            await worker.computeAndSaveScoreboards(sqlTimestamp);
            expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(2);
            expect(teamDAO.listForScoreboard).toHaveBeenCalledTimes(2);
          },
        );

        it("refreshes tags every ten minutes independently of frequent score changes", async () => {
          const start = Date.now();
          let timestamp = sqlTimestamp;
          await worker.computeAndSaveScoreboards(timestamp);

          for (let interval = 1; interval <= 2; interval++) {
            for (
              let minute = (interval - 1) * 10 + 1;
              minute < interval * 10;
              minute++
            ) {
              vi.setSystemTime(start + minute * 60 * 1000);
              timestamp = new Date(Date.now());
              submissionDAO.getSolvesForCalculation.mockResolvedValue([
                {
                  ...solve,
                  id: 42 + minute,
                  created_at: timestamp,
                  updated_at: timestamp,
                },
              ]);
              await worker.computeAndSaveScoreboards(timestamp);
            }
            const scoreWrites = 1 + interval * 9;
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(
              scoreWrites,
            );

            vi.setSystemTime(start + interval * 10 * 60 * 1000 - 1);
            await worker.computeAndSaveScoreboards(timestamp);
            expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(
              interval,
            );
            expect(teamDAO.listForScoreboard).toHaveBeenCalledTimes(
              scoreWrites + interval - 1,
            );

            vi.setSystemTime(start + interval * 10 * 60 * 1000);
            await worker.computeAndSaveScoreboards(timestamp);
            expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(
              interval + 1,
            );
            expect(teamDAO.listForScoreboard).toHaveBeenCalledTimes(
              scoreWrites + interval,
            );
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(
              scoreWrites,
            );
            expect(submissionDAO.getSolvesForCalculation).toHaveBeenCalledTimes(
              scoreWrites,
            );
          }
        });
      });

      it("skips a second ordinary computation without a SQL timestamp after publishing an empty scoreboard", async () => {
        submissionDAO.getSolvesForCalculation.mockResolvedValue([]);

        await worker.computeAndSaveScoreboards();
        await worker.computeAndSaveScoreboards();

        expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);
        expect(submissionDAO.getSolvesForCalculation).toHaveBeenCalledTimes(1);
        expect(challengeService.list).toHaveBeenCalledTimes(1);
        expect(scoreboardDataLoader.touchDivision).toHaveBeenCalledWith(
          1,
          pointers,
        );
        expect(scoreboardHistory.saveIteration.mock.calls).toEqual([
          [1, scoreboardDataLoader.saveIndexed.mock.calls[0][2], []],
        ]);
      });

      it("skips idle periodic polls when SQL activity remains null", async () => {
        vi.useFakeTimers();
        submissionDAO.getLatestActivityTimestamp.mockResolvedValue(null);
        submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
        const compute = vi.spyOn(worker, "computeAndSaveScoreboards");
        const controller = new AbortController();
        const startPromise = worker.start(controller.signal);
        try {
          await vi.advanceTimersByTimeAsync(0);
          expect(compute).toHaveResolvedTimes(1);
          expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);

          await vi.advanceTimersByTimeAsync(60 * 1000);
          expect(
            submissionDAO.getLatestActivityTimestamp,
          ).toHaveBeenCalledTimes(2);
          expect(compute.mock.calls).toEqual([[undefined], [undefined]]);
          expect(compute).toHaveResolvedTimes(2);
          expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);
          expect(submissionDAO.getSolvesForCalculation).toHaveBeenCalledTimes(
            1,
          );
          expect(scoreboardDataLoader.touchDivision).toHaveBeenCalledWith(
            1,
            pointers,
          );
        } finally {
          controller.abort();
          await startPromise;
        }
      });

      it("forces frozen history endpoints for a pre-freeze solve first processed after freeze", async () => {
        const cutoff = new Date(Date.now() + 60 * 1000);
        configService.get.mockResolvedValue({
          version: 1,
          value: { freeze_time_s: cutoff.getTime() / 1000 },
        });
        teamDAO.listForScoreboard.mockResolvedValue([
          { id: 10, division_id: 1, flags: [], tag_ids: [] },
          { id: 11, division_id: 1, flags: ["hidden"], tag_ids: [] },
          { id: 12, division_id: 1, flags: [], tag_ids: [] },
        ]);
        submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
        await worker.computeAndSaveScoreboards();
        expect(
          scoreboardDataLoader.saveIndexed.mock.lastCall![2].every(
            (entry) => entry.score === 0,
          ),
        ).toBe(true);
        scoreboardDataLoader.saveIndexed.mockClear();
        scoreboardHistory.saveIteration.mockClear();

        vi.setSystemTime(cutoff.getTime() + 5000);
        submissionDAO.getSolvesForCalculation.mockResolvedValue([
          { ...solve, updated_at: new Date(Date.now()) },
        ]);
        await worker.computeAndSaveScoreboards(new Date(Date.now()));

        const [frozen, latest] = scoreboardDataLoader.saveIndexed.mock.calls;
        expect(frozen[4]).toBe("frozen");
        expect(frozen[1]).toBe(cutoff.getTime());
        expect(frozen[2].find((entry) => entry.team_id === 10)).toMatchObject({
          score: 100,
          last_solve: solve.created_at,
          solves: [expect.objectContaining({ id: solve.id })],
        });
        for (const entry of frozen[2]) {
          expect(entry.updated_at).toEqual(cutoff);
        }
        expect(frozen[2].find((entry) => entry.team_id === 12)).toMatchObject({
          score: 0,
          hidden: true,
        });
        expect(latest[4]).toBe("latest");
        expect(latest[1]).toBeGreaterThan(cutoff.getTime());
        expect(scoreboardHistory.saveIteration.mock.calls).toEqual([
          [1, frozen[2], [11], true],
          [1, latest[2], [11]],
        ]);

        scoreboardHistory.saveIteration.mockClear();
        await worker.computeAndSaveScoreboards(undefined, true);
        expect(scoreboardHistory.saveIteration.mock.calls).toEqual([
          [1, scoreboardDataLoader.saveIndexed.mock.lastCall![2], [11]],
        ]);
      });

      it.each([
        ...routineEvents,
        { subject: ScoreboardTriggerEvent.$id!, data: { force: false } },
      ])(
        "skips a covered $subject burst with equal or older SQL activity (%j)",
        async ({ subject, data }) => {
          vi.useFakeTimers();
          await worker.computeAndSaveScoreboards(sqlTimestamp);
          const compute = vi.spyOn(worker, "computeAndSaveScoreboards");
          const controller = new AbortController();
          const startPromise = worker.start(controller.signal);
          try {
            await vi.advanceTimersByTimeAsync(0);
            expect(compute).toHaveResolvedTimes(1);
            const handler = eventBusService.subscribe.mock.calls[0][3].handler;
            const olderTimestamp = new Date(sqlTimestamp.getTime() - 1000);
            const timestamps = [
              sqlTimestamp,
              sqlTimestamp,
              olderTimestamp,
              olderTimestamp,
              sqlTimestamp,
            ];
            for (const timestamp of timestamps) {
              submissionDAO.getLatestActivityTimestamp.mockResolvedValue(
                timestamp,
              );
              await handler({
                subject,
                timestamp: new Date(Date.now() - 1),
                data,
              } as Parameters<typeof handler>[0]);

              expect(compute).toHaveBeenLastCalledWith(timestamp, false);
              expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);
              expect(
                submissionDAO.getSolvesForCalculation,
              ).toHaveBeenCalledTimes(1);
              expect(challengeService.list).toHaveBeenCalledTimes(1);
              expect(scoreboardHistory.saveIteration).toHaveBeenCalledTimes(1);
              expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(
                1,
              );
              expect(teamDAO.listForScoreboard).toHaveBeenCalledTimes(1);
              expect(
                scoreboardDataLoader.touchDivision,
              ).toHaveBeenLastCalledWith(1, pointers);
            }
            expect(compute).toHaveResolvedTimes(1 + timestamps.length);
            expect(
              submissionDAO.getLatestActivityTimestamp,
            ).toHaveBeenCalledTimes(1 + timestamps.length);
          } finally {
            controller.abort();
            await startPromise;
          }
        },
      );

      it.each(routineEvents)(
        "computes once for newer SQL activity even from a covered $subject and skips duplicate deliveries",
        async ({ subject, data }) => {
          vi.useFakeTimers();
          await worker.computeAndSaveScoreboards(sqlTimestamp);
          const compute = vi.spyOn(worker, "computeAndSaveScoreboards");
          const controller = new AbortController();
          const startPromise = worker.start(controller.signal);
          try {
            await vi.advanceTimersByTimeAsync(0);
            expect(compute).toHaveResolvedTimes(1);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);
            const timestamp = new Date(sqlTimestamp.getTime() + 1000);
            submissionDAO.getLatestActivityTimestamp.mockResolvedValue(
              timestamp,
            );
            submissionDAO.getSolvesForCalculation.mockResolvedValue([
              {
                ...solve,
                id: 43,
                created_at: timestamp,
                updated_at: timestamp,
              },
            ]);
            const handler = eventBusService.subscribe.mock.calls[0][3].handler;
            for (let delivery = 0; delivery < 3; delivery++) {
              await handler({
                subject,
                timestamp: new Date(Date.now() - 1),
                data,
              } as Parameters<typeof handler>[0]);

              expect(compute).toHaveBeenLastCalledWith(timestamp, false);
              expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(2);
              expect(
                submissionDAO.getSolvesForCalculation,
              ).toHaveBeenCalledTimes(2);
              expect(challengeService.list).toHaveBeenCalledTimes(2);
              expect(scoreboardHistory.saveIteration).toHaveBeenCalledTimes(2);
              expect(
                scoreboardDataLoader.saveIndexed.mock.lastCall![2][0].solves,
              ).toEqual([expect.objectContaining({ id: 43 })]);
            }
            expect(compute).toHaveResolvedTimes(4);
            expect(
              submissionDAO.getLatestActivityTimestamp,
            ).toHaveBeenCalledTimes(4);
          } finally {
            controller.abort();
            await startPromise;
          }
        },
      );

      it.each(
        routineEvents.flatMap((event) =>
          [0, 1].map((offset) => ({ ...event, offset })),
        ),
      )(
        "forces $subject $offset ms after coverage with unchanged SQL activity",
        async ({ subject, data, offset }) => {
          vi.useFakeTimers();
          const timestamp = new Date(Date.now() + offset);
          await worker.computeAndSaveScoreboards(sqlTimestamp);
          const compute = vi.spyOn(worker, "computeAndSaveScoreboards");
          const controller = new AbortController();
          const startPromise = worker.start(controller.signal);
          try {
            await vi.advanceTimersByTimeAsync(0);
            expect(compute).toHaveResolvedTimes(1);
            vi.setSystemTime(Date.now() + 1000);
            submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
            const handler = eventBusService.subscribe.mock.calls[0][3].handler;
            const event = {
              subject,
              timestamp,
              data,
            } as Parameters<typeof handler>[0];

            await handler(event);

            expect(compute).toHaveBeenLastCalledWith(sqlTimestamp, true);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(2);
            expect(
              scoreboardDataLoader.saveIndexed.mock.lastCall![2][0],
            ).toMatchObject({
              score: 0,
              solves: [],
            });

            await handler(event);
            expect(compute).toHaveBeenLastCalledWith(sqlTimestamp, false);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(2);

            // Event coverage must not become the SQL polling watermark.
            await worker.computeAndSaveScoreboards(
              new Date(sqlTimestamp.getTime() + 1),
            );
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(3);
          } finally {
            controller.abort();
            await startPromise;
          }
        },
      );

      it.each(routineEvents)(
        "forces an old queued $subject when startup skips existing snapshots without establishing coverage",
        async ({ subject, data }) => {
          vi.useFakeTimers();
          pointers.latest = Date.now();
          submissionDAO.getLatestActivityTimestamp.mockResolvedValue(
            new Date(0),
          );
          const compute = vi.spyOn(worker, "computeAndSaveScoreboards");
          const controller = new AbortController();
          const startPromise = worker.start(controller.signal);
          try {
            await vi.advanceTimersByTimeAsync(0);
            expect(compute).toHaveResolvedTimes(1);
            expect(scoreboardDataLoader.saveIndexed).not.toHaveBeenCalled();
            expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(1);
            const handler = eventBusService.subscribe.mock.calls[0][3].handler;
            await handler({
              subject,
              timestamp: sqlTimestamp,
              data,
            } as Parameters<typeof handler>[0]);

            expect(compute).toHaveBeenLastCalledWith(new Date(0), true);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);
          } finally {
            controller.abort();
            await startPromise;
          }
        },
      );

      it.each(
        [
          { graph: false, offset: -1 },
          { graph: false, offset: 0 },
          { graph: false, offset: 1 },
          { graph: true, offset: -1 },
          { graph: true, offset: 0 },
          { graph: true, offset: 1 },
        ].flatMap((calculation) =>
          routineEvents.map((event) => ({ ...calculation, ...event })),
        ),
      )(
        "covers $subject only before calculation start, not finish (%j)",
        async ({ graph, offset, subject, data }) => {
          vi.useFakeTimers();
          await worker.computeAndSaveScoreboards(sqlTimestamp);
          const compute = vi.spyOn(worker, "computeAndSaveScoreboards");
          const controller = new AbortController();
          const startPromise = worker.start(controller.signal);
          const pendingSave = Promise.withResolvers<void>();
          try {
            await vi.advanceTimersByTimeAsync(0);
            expect(compute).toHaveResolvedTimes(1);
            const startedAt = Date.now() + 1000;
            vi.setSystemTime(startedAt);
            scoreboardDataLoader.hasTeamTags.mockResolvedValueOnce(false);
            scoreboardHistory.saveIteration.mockReturnValueOnce(
              pendingSave.promise,
            );
            const handler = eventBusService.subscribe.mock.calls[0][3].handler;
            const calculation = handler({
              subject: ScoreboardTriggerEvent.$id!,
              timestamp: new Date(startedAt),
              data: graph ? { recompute_graph: true } : {},
            } as Parameters<typeof handler>[0]);
            await vi.advanceTimersByTimeAsync(0);
            expect(scoreboardHistory.saveIteration).toHaveBeenCalledTimes(2);

            vi.setSystemTime(startedAt + 100);
            const queuedEvent = {
              subject,
              timestamp: new Date(startedAt + offset),
              data,
            } as Parameters<typeof handler>[0];
            const followup = handler(queuedEvent);
            await vi.advanceTimersByTimeAsync(0);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(2);

            pendingSave.resolve();
            await calculation;
            await followup;

            expect(compute).toHaveBeenLastCalledWith(sqlTimestamp, offset >= 0);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(
              offset < 0 ? 2 : 3,
            );
            expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(
              subject === TeamUpdateEvent.$id && offset >= 0 ? 3 : 2,
            );
            await handler(queuedEvent);
            expect(compute).toHaveBeenLastCalledWith(sqlTimestamp, false);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(
              offset < 0 ? 2 : 3,
            );
          } finally {
            pendingSave.resolve();
            controller.abort();
            await startPromise;
          }
        },
      );

      it.each(
        ["tags", "snapshot", "history", "publish", "bitmap", "graph"].flatMap(
          (failure) => routineEvents.map((event) => ({ failure, ...event })),
        ),
      )(
        "does not advance $subject coverage when $failure persistence fails",
        async ({ failure, subject, data }) => {
          vi.useFakeTimers();
          await worker.computeAndSaveScoreboards(sqlTimestamp);
          const compute = vi.spyOn(worker, "computeAndSaveScoreboards");
          const controller = new AbortController();
          const startPromise = worker.start(controller.signal);
          try {
            await vi.advanceTimersByTimeAsync(0);
            expect(compute).toHaveResolvedTimes(1);
            const timestamp = new Date(Date.now() + 1000);
            vi.setSystemTime(Date.now() + 2000);
            submissionDAO.getSolvesForCalculation.mockResolvedValue([
              { ...solve, id: 43 },
            ]);
            scoreboardDataLoader.hasTeamTags.mockResolvedValueOnce(false);
            const error = new Error(`${failure} failed`);
            if (failure === "tags") {
              scoreboardDataLoader.saveTeamTags.mockRejectedValueOnce(error);
            } else if (failure === "snapshot") {
              scoreboardDataLoader.saveIndexed.mockRejectedValueOnce(error);
            } else if (failure === "history") {
              scoreboardHistory.saveIteration.mockRejectedValueOnce(error);
            } else if (failure === "publish") {
              eventBusService.publishBatch.mockRejectedValueOnce(error);
            } else if (failure === "bitmap") {
              scoreboardDataLoader.saveNotifiedSolves.mockRejectedValueOnce(
                error,
              );
            } else {
              scoreboardHistory.replaceAll.mockRejectedValueOnce(error);
            }
            const handler = eventBusService.subscribe.mock.calls[0][3].handler;
            await expect(
              handler({
                subject: ScoreboardTriggerEvent.$id!,
                timestamp,
                data: failure === "graph" ? { recompute_graph: true } : {},
              } as Parameters<typeof handler>[0]),
            ).rejects.toThrow(error);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(
              failure === "tags" ? 1 : 2,
            );

            const event = {
              subject,
              timestamp,
              data,
            } as Parameters<typeof handler>[0];
            await handler(event);
            expect(compute).toHaveBeenLastCalledWith(sqlTimestamp, true);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(
              failure === "tags" ? 2 : 3,
            );
            expect(
              scoreboardDataLoader.saveIndexed.mock.lastCall![2][0].solves,
            ).toEqual([expect.objectContaining({ id: 43 })]);

            await handler(event);
            expect(compute).toHaveBeenLastCalledWith(sqlTimestamp, false);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(
              failure === "tags" ? 2 : 3,
            );
          } finally {
            controller.abort();
            await startPromise;
          }
        },
      );

      it.each(
        ["skipped", "partial"].flatMap((refresh) =>
          routineEvents.map((event) => ({ refresh, ...event })),
        ),
      )(
        "does not advance $subject coverage after a $refresh periodic tag refresh",
        async ({ refresh, subject, data }) => {
          vi.useFakeTimers();
          const [division] = await divisionDAO.list();
          divisionDAO.list.mockResolvedValue([
            division,
            { ...division, id: 2, name: "Other", slug: "other" },
          ]);
          await worker.computeAndSaveScoreboards(sqlTimestamp);
          const compute = vi.spyOn(worker, "computeAndSaveScoreboards");
          const controller = new AbortController();
          const startPromise = worker.start(controller.signal);
          try {
            await vi.advanceTimersByTimeAsync(0);
            expect(compute).toHaveResolvedTimes(1);
            const timestamp = new Date(Date.now() + 1000);
            scoreboardDataLoader.hasTeamTags.mockResolvedValueOnce(false);
            if (refresh === "partial") {
              // Only division 2 has lost its cache; division 1 must be skipped.
              scoreboardDataLoader.getPointers.mockImplementationOnce(
                async () => ({ ...pointers }),
              );
              scoreboardDataLoader.getPointers.mockResolvedValueOnce({});
            }
            await vi.advanceTimersByTimeAsync(60 * 1000);
            expect(compute).toHaveResolvedTimes(2);
            expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(2);
            expect(
              scoreboardDataLoader.saveIndexed.mock.calls.map(
                (call) => call[0],
              ),
            ).toEqual(refresh === "partial" ? [1, 2, 2] : [1, 2]);

            const handler = eventBusService.subscribe.mock.calls[0][3].handler;
            await handler({
              subject,
              timestamp,
              data,
            } as Parameters<typeof handler>[0]);

            expect(compute).toHaveBeenLastCalledWith(sqlTimestamp, true);
            expect(
              scoreboardDataLoader.saveIndexed.mock.calls.map(
                (call) => call[0],
              ),
            ).toEqual(refresh === "partial" ? [1, 2, 2, 1, 2] : [1, 2, 1, 2]);
          } finally {
            controller.abort();
            await startPromise;
          }
        },
      );

      it.each([
        { graph: false, tags: "unchanged" },
        { graph: true, tags: "unchanged" },
        { graph: false, tags: "same calculation" },
        { graph: true, tags: "same calculation" },
        { graph: false, tags: "skipped poll" },
        { graph: true, tags: "skipped poll" },
      ])(
        "advances challenge coverage but team coverage only with tags in the same calculation (%j)",
        async ({ graph, tags }) => {
          vi.useFakeTimers();
          await worker.computeAndSaveScoreboards(sqlTimestamp);
          const compute = vi.spyOn(worker, "computeAndSaveScoreboards");
          const controller = new AbortController();
          const startPromise = worker.start(controller.signal);
          try {
            await vi.advanceTimersByTimeAsync(0);
            expect(compute).toHaveResolvedTimes(1);
            const timestamp = new Date(Date.now() + 1000);
            vi.setSystemTime(Date.now() + 2000);
            if (tags === "skipped poll") {
              scoreboardDataLoader.hasTeamTags.mockResolvedValueOnce(false);
              await worker.computeAndSaveScoreboards(sqlTimestamp);
              expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(
                2,
              );
              expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);
              vi.setSystemTime(Date.now() + 1000);
            } else if (tags === "same calculation") {
              scoreboardDataLoader.hasTeamTags.mockResolvedValueOnce(false);
            }
            const newerSQL = new Date(sqlTimestamp.getTime() + 1);
            submissionDAO.getLatestActivityTimestamp.mockResolvedValue(
              newerSQL,
            );
            if (graph) await worker.recomputeFullGraph(newerSQL);
            else await worker.computeAndSaveScoreboards(newerSQL);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(2);
            expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(
              tags === "unchanged" ? 1 : 2,
            );

            const handler = eventBusService.subscribe.mock.calls[0][3].handler;
            await handler({
              ...metadataEvents[1],
              timestamp,
            } as Parameters<typeof handler>[0]);
            expect(compute).toHaveBeenLastCalledWith(newerSQL, false);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(2);

            const teamEvent = {
              ...metadataEvents[0],
              timestamp,
            } as Parameters<typeof handler>[0];
            await handler(teamEvent);
            expect(compute).toHaveBeenLastCalledWith(
              newerSQL,
              tags !== "same calculation",
            );
            const writes = tags === "same calculation" ? 2 : 3;
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(
              writes,
            );
            expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(
              tags === "skipped poll" ? 3 : 2,
            );

            await handler(teamEvent);
            expect(compute).toHaveBeenLastCalledWith(newerSQL, false);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(
              writes,
            );
          } finally {
            controller.abort();
            await startPromise;
          }
        },
      );

      it.each(
        ["pointer", "tags"].flatMap((missing) =>
          routineEvents.map((event) => ({ missing, ...event })),
        ),
      )(
        "still repairs a missing $missing for a covered $subject",
        async ({ missing, subject, data }) => {
          vi.useFakeTimers();
          await worker.computeAndSaveScoreboards(sqlTimestamp);
          const compute = vi.spyOn(worker, "computeAndSaveScoreboards");
          const controller = new AbortController();
          const startPromise = worker.start(controller.signal);
          try {
            await vi.advanceTimersByTimeAsync(0);
            expect(compute).toHaveResolvedTimes(1);
            if (missing === "pointer") delete pointers.latest;
            else scoreboardDataLoader.hasTeamTags.mockResolvedValueOnce(false);
            const handler = eventBusService.subscribe.mock.calls[0][3].handler;
            await handler({
              subject,
              timestamp: new Date(Date.now() - 1),
              data,
            } as Parameters<typeof handler>[0]);

            expect(compute).toHaveBeenLastCalledWith(sqlTimestamp, false);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(
              missing === "pointer" ? 2 : 1,
            );
            expect(scoreboardDataLoader.saveTeamTags).toHaveBeenCalledTimes(
              missing === "tags" ? 2 : 1,
            );
            expect(pointers.latest).toBeDefined();
          } finally {
            controller.abort();
            await startPromise;
          }
        },
      );

      it("always rebuilds the graph for covered triggers with unchanged SQL activity even when force is false", async () => {
        vi.useFakeTimers();
        await worker.computeAndSaveScoreboards(sqlTimestamp);
        const compute = vi.spyOn(worker, "computeAndSaveScoreboards");
        const rebuild = vi.spyOn(worker, "recomputeFullGraph");
        const controller = new AbortController();
        const startPromise = worker.start(controller.signal);
        try {
          await vi.advanceTimersByTimeAsync(0);
          expect(compute).toHaveResolvedTimes(1);
          expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);
          const handler = eventBusService.subscribe.mock.calls[0][3].handler;
          for (let delivery = 1; delivery <= 2; delivery++) {
            await handler({
              subject: ScoreboardTriggerEvent.$id!,
              timestamp: new Date(Date.now() - 1),
              data: { recompute_graph: true, force: false },
            } as Parameters<typeof handler>[0]);

            expect(rebuild).toHaveBeenLastCalledWith(sqlTimestamp);
            expect(rebuild).toHaveResolvedTimes(delivery);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(
              1 + delivery,
            );
            expect(scoreboardHistory.replaceAll).toHaveBeenCalledTimes(
              delivery,
            );
            expect(scoreboardHistory.replaceAll).toHaveBeenLastCalledWith(
              expect.arrayContaining([
                expect.objectContaining({ team_id: 10 }),
              ]),
              [1],
            );
          }
          await worker.computeAndSaveScoreboards(sqlTimestamp);
          expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(3);
          expect(compute.mock.calls).toEqual([[sqlTimestamp], [sqlTimestamp]]);
        } finally {
          controller.abort();
          await startPromise;
        }
      });

      it.each([
        [
          "deleted team with an old payload timestamp",
          TeamUpdateEvent.$id!,
          new Date(400 * 1000),
        ],
        ["forced admin trigger", ScoreboardTriggerEvent.$id!, sqlTimestamp],
        ["config update", ConfigUpdateEvent.$id!, sqlTimestamp],
        ["challenge update", ChallengeUpdateEvent.$id!, sqlTimestamp],
      ])(
        "forces recalculation for %s without advancing the SQL watermark",
        async (_name, subject, timestamp) => {
          await worker.computeAndSaveScoreboards(sqlTimestamp);
          const compute = vi.spyOn(worker, "computeAndSaveScoreboards");
          const controller = new AbortController();
          const startPromise = worker.start(controller.signal);
          try {
            await vi.waitFor(() => expect(compute).toHaveResolvedTimes(1));
            expect(compute).toHaveBeenLastCalledWith(sqlTimestamp);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);

            submissionDAO.getLatestActivityTimestamp.mockResolvedValue(
              timestamp,
            );
            if (subject === TeamUpdateEvent.$id) {
              teamDAO.listForScoreboard.mockResolvedValue([]);
              submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
            }
            if (subject === ConfigUpdateEvent.$id) {
              configService.get.mockClear();
              configService.clearCache.mockImplementation(() => {
                configService.get.mockResolvedValue({
                  version: 2,
                  value: { freeze_time_s: 900 },
                });
              });
            }
            const handler = eventBusService.subscribe.mock.calls[0][3].handler;
            const data =
              subject === TeamUpdateEvent.$id
                ? {
                    id: 10,
                    division_id: 1,
                    flags: [],
                    type: "delete",
                    updated_at: timestamp,
                  }
                : subject === ConfigUpdateEvent.$id
                  ? { namespace: "setup", version: 2, updated_at: timestamp }
                  : subject === ChallengeUpdateEvent.$id
                    ? {
                        id: 100,
                        slug: "chal-1",
                        version: 2,
                        type: "update",
                        updated_at: timestamp,
                      }
                    : { force: true };
            const eventTimestamp = new Date(
              Date.now() +
                (subject === TeamUpdateEvent.$id ||
                subject === ChallengeUpdateEvent.$id
                  ? 1
                  : -1),
            );
            vi.setSystemTime(Date.now() + 1000);
            await handler({
              subject,
              timestamp: eventTimestamp,
              data,
            } as Parameters<typeof handler>[0]);

            expect(compute).toHaveBeenLastCalledWith(timestamp, true);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(
              subject === ConfigUpdateEvent.$id ? 3 : 2,
            );
            if (subject === TeamUpdateEvent.$id) {
              expect(
                scoreboardDataLoader.saveIndexed.mock.lastCall?.[2],
              ).toEqual([]);
            }
            if (subject === ConfigUpdateEvent.$id) {
              expect(configService.clearCache).toHaveBeenCalledTimes(1);
              expect(
                configService.clearCache.mock.invocationCallOrder[0],
              ).toBeLessThan(configService.get.mock.invocationCallOrder[0]);
              expect(pointers.frozen).toBe(900 * 1000);
            }

            await worker.computeAndSaveScoreboards(sqlTimestamp);
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(
              subject === ConfigUpdateEvent.$id ? 3 : 2,
            );
            await worker.computeAndSaveScoreboards(
              new Date(sqlTimestamp.getTime() + 1),
            );
            expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(
              subject === ConfigUpdateEvent.$id ? 4 : 3,
            );
          } finally {
            controller.abort();
            await startPromise;
          }
        },
      );

      it.each(["latest", "frozen", "both"])(
        "recovers lost %s pointers with unchanged SQL activity using fresh validated reads",
        async (lost) => {
          configService.get.mockResolvedValue({
            version: 1,
            value: { freeze_time_s: 900 },
          });
          await worker.computeAndSaveScoreboards(sqlTimestamp);
          scoreboardDataLoader.saveIndexed.mockClear();
          if (lost !== "frozen") delete pointers.latest;
          if (lost !== "latest") delete pointers.frozen;

          await worker.computeAndSaveScoreboards(sqlTimestamp);

          expect(scoreboardDataLoader.getPointers).toHaveBeenCalledTimes(2);
          for (const call of scoreboardDataLoader.getPointers.mock.calls) {
            expect(call).toEqual([1, ["latest", "frozen"], true]);
          }
          expect(
            scoreboardDataLoader.saveIndexed.mock.calls.map((call) => call[4]),
          ).toEqual(lost === "latest" ? ["latest"] : ["frozen", "latest"]);
          expect(pointers.frozen).toBe(900 * 1000);
          expect(pointers.latest).toBeGreaterThanOrEqual(Date.now());
        },
      );

      it("reconciles scheduled visibility at the earliest visible_at without newer SQL activity", async () => {
        const [challenge] = await challengeService.list({ hidden: false });
        const visibleAt = Date.now() + 60 * 1000;
        challengeService.list.mockResolvedValue([
          {
            ...challenge,
            id: 101,
            visible_at: new Date(visibleAt + 60 * 1000),
          },
          { ...challenge, visible_at: new Date(visibleAt) },
        ]);
        challengeService.list.mockClear();
        await worker.computeAndSaveScoreboards(sqlTimestamp);
        expect(scoreboardDataLoader.saveIndexed.mock.lastCall?.[3].size).toBe(
          0,
        );
        expect(scoreService.getExpr).not.toHaveBeenCalled();
        expect(eventBusService.publishBatch).not.toHaveBeenCalled();

        vi.setSystemTime(visibleAt - 1);
        await worker.computeAndSaveScoreboards(sqlTimestamp);
        expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);

        vi.setSystemTime(visibleAt);
        await worker.computeAndSaveScoreboards(sqlTimestamp);
        expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(2);
        expect([
          ...scoreboardDataLoader.saveIndexed.mock.lastCall![3].keys(),
        ]).toEqual([100]);
        expect(
          scoreboardDataLoader.saveIndexed.mock.lastCall?.[2][0].score,
        ).toBe(100);
        expect(eventBusService.publishBatch).toHaveBeenCalledTimes(1);

        vi.setSystemTime(visibleAt + 60 * 1000);
        await worker.computeAndSaveScoreboards(sqlTimestamp);
        expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(3);
        expect([
          ...scoreboardDataLoader.saveIndexed.mock.lastCall![3].keys(),
        ]).toEqual([101, 100]);
        expect(challengeService.list.mock.calls).toEqual([
          [{ hidden: false }],
          [{ hidden: false }],
          [{ hidden: false }],
        ]);
      });

      it("reconciles after ten minutes of unchanged SQL activity and resets the interval", async () => {
        const start = Date.now();
        await worker.computeAndSaveScoreboards(sqlTimestamp);
        submissionDAO.getSolvesForCalculation.mockResolvedValue([]);

        vi.setSystemTime(start + 10 * 60 * 1000 - 1);
        await worker.computeAndSaveScoreboards(sqlTimestamp);
        expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(1);

        vi.setSystemTime(start + 10 * 60 * 1000);
        await worker.computeAndSaveScoreboards(sqlTimestamp);
        expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(2);
        expect(
          scoreboardDataLoader.saveIndexed.mock.lastCall?.[2][0].score,
        ).toBe(0);

        vi.setSystemTime(start + 20 * 60 * 1000 - 1);
        await worker.computeAndSaveScoreboards(sqlTimestamp);
        expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(2);
        vi.setSystemTime(start + 20 * 60 * 1000);
        await worker.computeAndSaveScoreboards(sqlTimestamp);
        expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(3);
      });

      it.each(["publish", "bitmap save"])(
        "retries notifications after %s fails without installing the candidate bitmap",
        async (failure) => {
          const bitmap = new roaring.RoaringBitmap32([7]);
          scoreboardDataLoader.getNotifiedSolves.mockResolvedValue(
            bitmap.serialize(false) as Buffer,
          );
          const error = new Error(`${failure} failed`);
          if (failure === "publish") {
            eventBusService.publishBatch.mockRejectedValueOnce(error);
          } else {
            scoreboardDataLoader.saveNotifiedSolves.mockRejectedValueOnce(
              error,
            );
          }

          await expect(
            worker.computeAndSaveScoreboards(sqlTimestamp),
          ).rejects.toThrow(error);
          expect(pointers.latest).toBe(Date.now());
          expect(scoreboardDataLoader.saveNotifiedSolves).toHaveBeenCalledTimes(
            failure === "publish" ? 0 : 1,
          );

          await worker.computeAndSaveScoreboards(sqlTimestamp);
          expect(scoreboardDataLoader.saveIndexed).toHaveBeenCalledTimes(2);
          expect(eventBusService.publishBatch).toHaveBeenCalledTimes(2);
          expect(eventBusService.publishBatch.mock.calls[1]).toEqual(
            eventBusService.publishBatch.mock.calls[0],
          );
          const saved =
            scoreboardDataLoader.saveNotifiedSolves.mock.lastCall![0];
          expect(
            roaring.RoaringBitmap32.deserialize(saved, false).toArray(),
          ).toEqual([7, 42]);
          expect(
            eventBusService.publishBatch.mock.invocationCallOrder[1],
          ).toBeLessThan(
            scoreboardDataLoader.saveNotifiedSolves.mock.invocationCallOrder.at(
              -1,
            )!,
          );

          await worker.computeAndSaveScoreboards(sqlTimestamp, true);
          expect(eventBusService.publishBatch).toHaveBeenCalledTimes(2);
          expect(scoreboardDataLoader.saveNotifiedSolves).toHaveBeenCalledTimes(
            failure === "publish" ? 1 : 2,
          );
        },
      );

      it("replaces a populated notification bitmap with an empty one after an empty full rebuild", async () => {
        await worker.computeAndSaveScoreboards(sqlTimestamp);
        submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
        eventBusService.publishBatch.mockClear();
        scoreboardDataLoader.saveNotifiedSolves.mockClear();

        await worker.recomputeFullGraph(sqlTimestamp);

        expect(scoreboardHistory.replaceAll).toHaveBeenCalledWith([], [1]);
        expect(eventBusService.publishBatch).not.toHaveBeenCalled();
        expect(scoreboardDataLoader.saveNotifiedSolves).toHaveBeenCalledTimes(
          1,
        );
        expect(
          roaring.RoaringBitmap32.deserialize(
            scoreboardDataLoader.saveNotifiedSolves.mock.lastCall![0],
            false,
          ).toArray(),
        ).toEqual([]);
        expect(
          scoreboardHistory.replaceAll.mock.invocationCallOrder[0],
        ).toBeLessThan(
          scoreboardDataLoader.saveNotifiedSolves.mock.invocationCallOrder[0],
        );

        submissionDAO.getSolvesForCalculation.mockResolvedValue([solve]);
        await worker.computeAndSaveScoreboards(sqlTimestamp, true);
        expect(eventBusService.publishBatch).toHaveBeenCalledTimes(1);
      });

      it("advances publication versions and history timestamps when the last solve is removed", async () => {
        const now = Date.now();
        submissionDAO.getSolvesForCalculation.mockResolvedValue([
          { ...solve, updated_at: new Date(now + 100) },
        ]);
        await worker.computeAndSaveScoreboards(new Date(now + 100));
        const first = scoreboardDataLoader.saveIndexed.mock.lastCall!;
        expect(first[1]).toBe(now + 101);
        expect(first[2][0]).toMatchObject({
          score: 100,
          updated_at: new Date(first[1]),
        });

        submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
        vi.setSystemTime(now - 100);
        await worker.computeAndSaveScoreboards(sqlTimestamp, true);
        const second = scoreboardDataLoader.saveIndexed.mock.lastCall!;
        expect(second[1]).toBe(first[1] + 1);
        expect(second[2][0]).toMatchObject({
          score: 0,
          solves: [],
          last_solve: new Date(0),
          updated_at: new Date(second[1]),
        });
        expect(scoreboardHistory.saveIteration.mock.calls).toEqual([
          [1, first[2], []],
          [1, second[2], []],
        ]);
        expect(scoreboardDataLoader.expireVersions).toHaveBeenLastCalledWith(
          1,
          [first[1]],
          10,
        );
      });

      it("keeps latest distinct from frozen at the exact freeze timestamp", async () => {
        configService.get.mockResolvedValue({
          version: 1,
          value: { freeze_time_s: Date.now() / 1000 },
        });
        // With no solves, the live publication would otherwise equal the cutoff.
        submissionDAO.getSolvesForCalculation.mockResolvedValue([]);
        await worker.computeAndSaveScoreboards(sqlTimestamp);

        expect(pointers).toEqual({
          frozen: Date.now(),
          latest: Date.now() + 1,
        });
        expect(
          scoreboardDataLoader.saveIndexed.mock.calls[0][2][0].updated_at.getTime(),
        ).toBe(Date.now());
        expect(
          scoreboardDataLoader.saveIndexed.mock.calls[1][2][0].updated_at,
        ).toEqual(new Date(pointers.latest));
      });
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
        async (signal, _name, _subjects, opts) => {
          handler = opts.handler as (data: unknown) => Promise<void>;
          await new Promise<void>((resolve) =>
            signal.addEventListener("abort", () => resolve(), { once: true }),
          );
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
