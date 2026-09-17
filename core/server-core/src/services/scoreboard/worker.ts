import {
  ChallengeUpdateEvent,
  ScoreboardTriggerEvent,
  ConfigUpdateEvent,
  TeamUpdateEvent,
} from "@noctf/api/events";
import { ServiceCradle } from "../../index.ts";
import { DivisionDAO } from "../../dao/division.ts";
import {
  ChallengeMetadataWithExpr,
  ComputedChallengeScoreData,
  ComputeFullGraph,
  ComputeScoreboard,
  PartitionSolvesByChallenge,
} from "./calc.ts";
import { HistoryDataPoint } from "../../dao/score_history.ts";
import { SetupConfig } from "@noctf/api/config";
import roaring from "roaring";
import { AwardDAO } from "../../dao/award.ts";
import { ScoreboardDataLoader } from "./loader.ts";
import { MinimalTeamInfo, TeamDAO } from "../../dao/team.ts";
import { RawSolve, SubmissionDAO } from "../../dao/submission.ts";
import {
  Award,
  ChallengeMetadata,
  ScoreboardEntry,
} from "@noctf/api/datatypes";
import { ScoreboardHistory } from "./history.ts";
import { ChallengeSolveEvent } from "@noctf/api/events";
import { Delay } from "../../util/time.ts";
import { MaxDate } from "../../util/date.ts";
import { AbortableMutex } from "../../util/abortable_mutex.ts";

export type PointerTarget = {
  name: string;
  cutoff?: Date;
};

export type DivisionContext = {
  division_id: number;
  teams: MinimalTeamInfo[];
  challenges: ChallengeMetadataWithExpr[];
  solves: RawSolve[];
  awards: Award[];
  setup: SetupConfig;
};

export type CommittedDivision = {
  version: number;
  scoreboard: ScoreboardEntry[];
  challenges: Map<number, ComputedChallengeScoreData>;
};

export type ScoreboardWorkerProps = Pick<
  ServiceCradle,
  | "configService"
  | "challengeService"
  | "scoreService"
  | "eventBusService"
  | "databaseClient"
  | "redisClientFactory"
  | "logger"
>;

const PERIODIC_INTERVAL_SECONDS = 60;

export class ScoreboardWorker {
  private readonly logger;
  private readonly challengeService;
  private readonly configService;
  private readonly scoreService;
  private readonly eventBusService;

  private readonly history;
  private readonly dataLoader;

  private readonly awardDAO;
  private readonly submissionDAO;
  private readonly teamDAO;
  private readonly divisionDAO;

  private lastProcessedEventTime: Date = new Date(0);
  private notifiedSolves: roaring.RoaringBitmap32 | null = null;
  private readonly divisionPointers = new Map<number, Record<string, number>>();
  private readonly calculationGate = new AbortableMutex();

  constructor({
    configService,
    challengeService,
    databaseClient,
    eventBusService,
    redisClientFactory,
    scoreService,
    logger,
  }: ScoreboardWorkerProps) {
    this.logger = logger;
    this.challengeService = challengeService;
    this.configService = configService;
    this.scoreService = scoreService;
    this.eventBusService = eventBusService;

    this.dataLoader = new ScoreboardDataLoader(redisClientFactory);
    this.history = new ScoreboardHistory({
      redisClientFactory,
      databaseClient,
    });

    this.awardDAO = new AwardDAO(databaseClient.get());
    this.submissionDAO = new SubmissionDAO(databaseClient.get());
    this.teamDAO = new TeamDAO(databaseClient.get());
    this.divisionDAO = new DivisionDAO(databaseClient.get());
  }

  async start(signal: AbortSignal): Promise<void> {
    this.logger.info("Scoreboard worker started");
    const cancellation = new AbortController();
    const workerSignal = AbortSignal.any([signal, cancellation.signal]);

    // Subscribe to EventBus while leader
    const eventBusPromise = this.subscribeEvents(workerSignal);

    // Periodic sweep loop
    const periodicPromise = this.runPeriodicSweep(workerSignal);

    try {
      await Promise.race([eventBusPromise, periodicPromise]);
    } finally {
      cancellation.abort();
      await Promise.allSettled([eventBusPromise, periodicPromise]);
      await this.calculationGate.idle();
    }
  }

  private async runCalculation(
    signal: AbortSignal,
    calculation: () => Promise<void>,
  ): Promise<void> {
    if (!(await this.calculationGate.acquire(signal))) return;
    try {
      if (!signal.aborted) await calculation();
    } finally {
      this.calculationGate.release();
    }
  }

  private async subscribeEvents(signal: AbortSignal): Promise<void> {
    try {
      await this.eventBusService.subscribe<
        | ChallengeUpdateEvent
        | TeamUpdateEvent
        | ScoreboardTriggerEvent
        | ConfigUpdateEvent
      >(
        signal,
        "ScoreboardWorker",
        [
          ChallengeUpdateEvent.$id!,
          TeamUpdateEvent.$id!,
          ScoreboardTriggerEvent.$id!,
          ConfigUpdateEvent.$id!,
        ],
        {
          concurrency: 1,
          handler: async (data) => {
            if (data.subject === ScoreboardTriggerEvent.$id!) {
              const trigger = data.data as ScoreboardTriggerEvent;
              const sqlTimestamp =
                await this.submissionDAO.getLatestActivityTimestamp();
              const eventTimestamp = sqlTimestamp ?? data.timestamp;
              if (trigger.recompute_graph) {
                return await this.runCalculation(signal, () =>
                  this.recomputeFullGraph(eventTimestamp),
                );
              }
              return await this.runCalculation(signal, () =>
                this.computeAndSaveScoreboards(eventTimestamp),
              );
            }

            // Team, challenge, and config updates use the time the record was updated
            const record = data.data as { updated_at?: Date | string };
            const recordTime = record?.updated_at
              ? new Date(record.updated_at)
              : data.timestamp;

            await this.runCalculation(signal, () =>
              this.computeAndSaveScoreboards(recordTime),
            );
          },
        },
      );
    } catch (e) {
      if (!signal.aborted) {
        this.logger.error(
          e,
          "Scoreboard worker event subscription stopped unexpectedly",
        );
        throw e;
      }
    }
  }

  private async runPeriodicSweep(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        const sqlTimestamp =
          await this.submissionDAO.getLatestActivityTimestamp();
        await this.runCalculation(signal, () =>
          this.computeAndSaveScoreboards(sqlTimestamp ?? undefined),
        );
      } catch (e) {
        this.logger.error(e, "Error during periodic scoreboard sweep");
      }

      await Delay(PERIODIC_INTERVAL_SECONDS * 1000, signal);
    }
  }

  private async getPointers(
    division_id: number,
  ): Promise<Record<string, number>> {
    const cached = this.divisionPointers.get(division_id);
    if (cached) return cached;
    const loaded =
      (await this.dataLoader.getPointers(division_id, ["latest", "frozen"])) ??
      {};
    this.divisionPointers.set(division_id, loaded);
    return loaded;
  }

  private getTargetPointers(setup: SetupConfig): {
    name: string;
    cutoff?: Date;
  }[] {
    const targets: { name: string; cutoff?: Date }[] = [];
    if (typeof setup.freeze_time_s === "number") {
      const freezeDate = new Date(setup.freeze_time_s * 1000);
      if (Date.now() >= freezeDate.getTime()) {
        targets.push({ name: "frozen", cutoff: freezeDate });
      }
    }
    targets.push({ name: "latest" });
    return targets;
  }

  private async fetchScoreboardCalculationParams(
    eventTimestamp?: Date,
    force = false,
  ) {
    const { value: setup } = await this.configService.get(SetupConfig);
    const targetPointers = this.getTargetPointers(setup);
    const hasPendingEvents =
      eventTimestamp !== undefined
        ? eventTimestamp.getTime() > this.lastProcessedEventTime.getTime()
        : this.lastProcessedEventTime.getTime() === 0;

    const divisions = (
      await Promise.all(
        (await this.divisionDAO.list()).map(async (d) => {
          const currentPointers = await this.getPointers(d.id);

          const isUpToDate =
            !force &&
            !hasPendingEvents &&
            targetPointers.every(({ name, cutoff }) => {
              const current = currentPointers[name];
              if (current === undefined) return false;
              if (cutoff) {
                return current === cutoff.getTime();
              }
              return true;
            });

          if (!isUpToDate) {
            this.logger.info(
              {
                division_id: d.id,
                hasPendingEvents,
                eventTimestamp,
              },
              "Queuing division for recalculation",
            );
            return { division: d, pointers: currentPointers };
          }

          this.logger.info(
            { division_id: d.id, currentPointers },
            "Skipping recalculation for division",
          );
          await this.dataLoader.touchDivision(d.id, currentPointers);
          return null;
        }),
      )
    ).filter((v): v is Exclude<typeof v, null> => !!v);
    if (!divisions.length) {
      return {
        teams: new Map<number, MinimalTeamInfo[]>(),
        divisions: [],
        challenges: [],
      };
    }

    const challenges: ChallengeMetadataWithExpr[] = await Promise.all(
      (
        await this.challengeService.list({
          hidden: false,
          visible_at: new Date(),
        })
      ).map(async (metadata: ChallengeMetadata) => ({
        expr: await this.scoreService.getExpr(
          metadata.private_metadata.score.strategy,
        ),
        metadata,
      })),
    );

    const teams = await this.teamDAO.listForScoreboard();
    const teamMap = new Map<number, MinimalTeamInfo[]>(
      divisions.map(
        ({ division: { id } }) => [id, []] as [number, MinimalTeamInfo[]],
      ),
    );
    teams.forEach((t) => teamMap.get(t.division_id)?.push(t));
    return {
      teams: teamMap,
      divisions,
      challenges,
    };
  }

  async computeAndSaveScoreboards(eventTimestamp?: Date) {
    this.logger.info("Computing scoreboard");
    const { challenges, teams, divisions } =
      await this.fetchScoreboardCalculationParams(eventTimestamp);
    if (!divisions.length || !teams.size) {
      if (eventTimestamp) {
        this.lastProcessedEventTime = MaxDate(
          this.lastProcessedEventTime,
          eventTimestamp,
        );
      }
      return;
    }

    await this.dataLoader.saveTeamTags(
      teams
        .values()
        .flatMap((v) => v)
        .toArray(),
    );

    const commits: [number, CommittedDivision][] = [];
    for (const { division, pointers } of divisions) {
      const committed = await this.commitDivisionScoreboard(
        teams.get(division.id) || [],
        challenges,
        division.id,
        pointers,
      );
      commits.push([division.id, committed]);
    }
    await this.emitEvents(commits);
    if (eventTimestamp) {
      this.lastProcessedEventTime = MaxDate(
        this.lastProcessedEventTime,
        eventTimestamp,
      );
    }
  }

  private async emitEvents(
    commits: [number, CommittedDivision][],
    dryRun = false,
  ) {
    if (this.notifiedSolves === null) {
      const bin = await this.dataLoader.getNotifiedSolves();
      this.notifiedSolves = bin
        ? roaring.RoaringBitmap32.deserialize(bin, false)
        : new roaring.RoaringBitmap32();
    }

    const map = this.notifiedSolves;
    const items: ChallengeSolveEvent[] = [];
    let hasNew = false;
    for (const [id, division] of commits) {
      for (const solves of division.challenges.values()) {
        for (const [idx, solve] of solves.solves.entries()) {
          if (!solve.hidden && !map.has(solve.id)) {
            map.add(solve.id);
            hasNew = true;
            if (!dryRun) {
              items.push({ ...solve, seq: idx + 1, division_id: id });
            }
          }
        }
      }
    }
    if (items.length && !dryRun) {
      await this.eventBusService.publishBatch(ChallengeSolveEvent, items);
    }
    if (hasNew) {
      map.runOptimize();
      await this.dataLoader.saveNotifiedSolves(map.serialize(false) as Buffer);
    }
  }

  async recomputeFullGraph(eventTimestamp?: Date) {
    const { challenges, teams, divisions } =
      await this.fetchScoreboardCalculationParams(eventTimestamp, true);

    let points: HistoryDataPoint[] = [];
    const commits: [number, CommittedDivision][] = [];
    for (const { division, pointers } of divisions) {
      const id = division.id;
      const [solveList, awardList, { value: setup }] = await Promise.all([
        this.submissionDAO.getSolvesForCalculation(id),
        this.awardDAO.getAllAwards(id),
        this.configService.get(SetupConfig),
      ]);
      const solvesByChallenge = PartitionSolvesByChallenge(solveList, setup);
      points = points.concat(
        ComputeFullGraph(
          new Map(teams.get(id)?.map((x) => [x.id, x])),
          challenges,
          solvesByChallenge,
          awardList,
        ),
      );

      const committed = await this.commitDivisionScoreboard(
        teams.get(id) || [],
        challenges,
        id,
        pointers,
      );
      commits.push([id, committed]);
    }
    await this.history.replaceAll(
      points,
      divisions.map(({ division: { id } }) => id),
    );

    // Reset to an empty bitmap and dryRun emitEvents to fill and save it without emitting events
    this.notifiedSolves = new roaring.RoaringBitmap32();
    await this.emitEvents(commits, true);

    if (eventTimestamp) {
      this.lastProcessedEventTime = MaxDate(
        this.lastProcessedEventTime,
        eventTimestamp,
      );
    }
  }

  private async commitDivisionScoreboard(
    teams: MinimalTeamInfo[],
    challenges: ChallengeMetadataWithExpr[],
    id: number,
    currentPointers: Record<string, number>,
  ): Promise<CommittedDivision> {
    const [solves, awards, { value: setup }] = await Promise.all([
      this.submissionDAO.getSolvesForCalculation(id),
      this.awardDAO.getAllAwards(id),
      this.configService.get(SetupConfig),
    ]);

    const ctx: DivisionContext = {
      division_id: id,
      teams,
      challenges,
      solves,
      awards,
      setup,
    };

    const targetPointers = this.getTargetPointers(setup);
    const prevVersions = Object.values(currentPointers).filter(Boolean);
    const activeVersions = new Set<number>();

    let latest: CommittedDivision | undefined;

    const committedPointers = { ...currentPointers };
    for (const target of targetPointers) {
      const prevVersion = currentPointers[target.name];
      const targetVersion = target.cutoff?.getTime();

      // If pointer has a fixed target version (e.g. cutoff) and is already at that version, just touch
      if (targetVersion && prevVersion === targetVersion) {
        await this.dataLoader.touchDivision(id, {
          [target.name]: targetVersion,
        });
        activeVersions.add(targetVersion);
        continue;
      }

      const res = await this.commitDivisionForPointer(ctx, target);
      activeVersions.add(res.version);
      committedPointers[target.name] = res.version;
      if (target.name === "latest") {
        latest = res;
      }
    }
    this.divisionPointers.set(id, committedPointers);

    if (latest && latest.scoreboard.length) {
      await this.history.saveIteration(id, latest.scoreboard);
    }

    // Expire unused versions somewhat eagerly (with a small grace period)
    const toExpire = prevVersions.filter((v) => !activeVersions.has(v));
    await this.dataLoader.expireVersions(id, toExpire, 10);
    return latest!; // latest always exists
  }

  private async commitDivisionForPointer(
    ctx: DivisionContext,
    target: PointerTarget,
  ): Promise<CommittedDivision> {
    const targetVersion = target.cutoff?.getTime();
    const solvesByChallenge = PartitionSolvesByChallenge(
      ctx.solves,
      ctx.setup,
      target.cutoff,
    );

    const {
      last_event,
      scoreboard,
      challenges: challengeScores,
    } = ComputeScoreboard(
      new Map(ctx.teams.map((x) => [x.id, x])),
      ctx.challenges,
      solvesByChallenge,
      target.cutoff
        ? ctx.awards.filter((x) => x.created_at <= target.cutoff!)
        : ctx.awards,
    );

    if (target.cutoff) {
      for (const entry of scoreboard) {
        if (entry.updated_at > target.cutoff) {
          entry.updated_at = target.cutoff;
        }
        if (entry.last_solve > target.cutoff) {
          entry.last_solve = target.cutoff;
        }
      }
    }

    const version = targetVersion ? targetVersion : last_event.getTime();

    await this.dataLoader.saveIndexed(
      ctx.division_id,
      version,
      scoreboard,
      challengeScores,
      target.name,
    );

    return { version, scoreboard, challenges: challengeScores };
  }
}
