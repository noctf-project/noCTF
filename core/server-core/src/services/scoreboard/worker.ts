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
import { AbortableMutex } from "../../util/abortable_mutex.ts";
import type { EventItem } from "../event_bus.ts";
import { ScoreboardCalculationState } from "./calculation_state.ts";

type ScoreboardUpdateEvent =
  | ChallengeUpdateEvent
  | TeamUpdateEvent
  | ScoreboardTriggerEvent
  | ConfigUpdateEvent;

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
const RECONCILIATION_INTERVAL_MS = 10 * 60 * 1000;

function computeSnapshotVersion(
  targetCutoff: Date | undefined,
  previousVersion: number,
  lastEventTime: number,
  freezeTimeSeconds?: number,
): number {
  if (targetCutoff) {
    return targetCutoff.getTime();
  }

  let version = Math.max(Date.now(), previousVersion + 1, lastEventTime + 1);
  if (freezeTimeSeconds !== undefined && version === freezeTimeSeconds * 1000) {
    version++;
  }
  return version;
}

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

  private readonly calculationState = new ScoreboardCalculationState();
  private notifiedSolves: roaring.RoaringBitmap32 | null = null;
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
      await this.eventBusService.subscribe<ScoreboardUpdateEvent>(
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
          handler: (data) => this.handleEvent(data, signal),
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

  private async handleEvent(
    data: EventItem<ScoreboardUpdateEvent>,
    signal: AbortSignal,
  ): Promise<void> {
    await this.runCalculation(signal, async () => {
      // JetStream timestamps are post-commit. With synchronized clocks,
      // events before a successful calculation's start are covered.
      // Equality is not covered because event timestamps lose sub-ms precision.
      const triggerForce =
        data.subject === ScoreboardTriggerEvent.$id! &&
        (data.data as ScoreboardTriggerEvent).force === true;
      const force = this.calculationState.shouldForceForEvent({
        subject: data.subject,
        timestamp: data.timestamp,
        forceTrigger: triggerForce,
      });

      if (data.subject === TeamUpdateEvent.$id! && force) {
        this.calculationState.markTeamTagsDirty();
      }

      if (data.subject === ConfigUpdateEvent.$id!) {
        this.configService.clearCache();
      }
      const sqlTimestamp =
        await this.submissionDAO.getLatestActivityTimestamp();
      if (
        data.subject === ScoreboardTriggerEvent.$id! &&
        (data.data as ScoreboardTriggerEvent).recompute_graph
      ) {
        await this.recomputeFullGraph(sqlTimestamp ?? undefined);
      } else {
        await this.computeAndSaveScoreboards(sqlTimestamp ?? undefined, force);
      }
    });
  }

  private async getPointers(
    division_id: number,
  ): Promise<Record<string, number>> {
    return (
      (await this.dataLoader.getPointers(
        division_id,
        ["latest", "frozen"],
        true,
      )) ?? {}
    );
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

  private async getDivisionsToRecalculate(
    targetPointers: PointerTarget[],
    now: number,
    eventTimestamp?: Date,
    force = false,
  ) {
    // Timestamps cannot detect scheduled visibility, deletions, or late commits.
    // Keep the cheap polling path, with a bounded reconciliation fallback.
    force ||= this.calculationState.isStale(now, RECONCILIATION_INTERVAL_MS);
    const hasPendingEvents =
      this.calculationState.hasPendingEvents(eventTimestamp);

    const allDivisions = await this.divisionDAO.list();
    const divisions = (
      await Promise.all(
        allDivisions.map(async (d) => {
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
    return {
      divisions,
      coversAllDivisions: divisions.length === allDivisions.length,
    };
  }

  private async fetchScoreboardCalculationParams(
    eventTimestamp?: Date,
    force = false,
  ) {
    const { value: setup } = await this.configService.get(SetupConfig);
    const targetPointers = this.getTargetPointers(setup);
    const now = Date.now();
    let teams = await this.refreshTeamTagsIfNeeded(now);
    const { divisions, coversAllDivisions } =
      await this.getDivisionsToRecalculate(
        targetPointers,
        now,
        eventTimestamp,
        force,
      );
    if (!divisions.length) {
      return {
        teams: new Map<number, MinimalTeamInfo[]>(),
        divisions: [],
        challenges: [],
        setup,
        nextVisibilityTime: this.calculationState.getNextVisibilityTime(),
        coversAllDivisions: false,
        refreshedTeamTags: false,
      };
    }

    const allChallenges = await this.challengeService.list({ hidden: false });
    const nextVisibilityTime = allChallenges.reduce(
      (next, { visible_at }) =>
        visible_at && visible_at.getTime() > now
          ? Math.min(next, visible_at.getTime())
          : next,
      Infinity,
    );
    const challenges: ChallengeMetadataWithExpr[] = await Promise.all(
      allChallenges
        .filter(({ visible_at }) => !visible_at || visible_at.getTime() <= now)
        .map(async (metadata: ChallengeMetadata) => ({
          expr: await this.scoreService.getExpr(
            metadata.private_metadata.score.strategy,
          ),
          metadata,
        })),
    );

    const refreshedTeamTags = teams !== undefined;
    teams ??= await this.teamDAO.listForScoreboard();
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
      setup,
      nextVisibilityTime,
      coversAllDivisions,
      refreshedTeamTags,
    };
  }

  private async refreshTeamTagsIfNeeded(
    now: number,
  ): Promise<MinimalTeamInfo[] | undefined> {
    if (
      !this.calculationState.needsTeamTagsRefresh(
        now,
        RECONCILIATION_INTERVAL_MS,
      ) &&
      (await this.dataLoader.hasTeamTags())
    ) {
      return undefined;
    }
    const teams = await this.teamDAO.listForScoreboard();
    await this.dataLoader.saveTeamTags(teams);
    this.calculationState.recordTeamTagsRefreshed(now);
    return teams;
  }

  async computeAndSaveScoreboards(eventTimestamp?: Date, force = false) {
    const startedAt = Date.now();
    this.logger.info("Computing scoreboard");
    const {
      challenges,
      teams,
      divisions,
      nextVisibilityTime,
      coversAllDivisions,
      refreshedTeamTags,
      setup,
    } = await this.fetchScoreboardCalculationParams(eventTimestamp, force);
    if (!divisions.length || !teams.size) {
      if (eventTimestamp) {
        this.calculationState.recordEventTimestamp(eventTimestamp);
      }
      return;
    }

    const commits: [number, CommittedDivision][] = [];
    for (const { division, pointers } of divisions) {
      const ctx = await this.fetchDivisionContext(
        teams.get(division.id) || [],
        challenges,
        division.id,
        setup,
      );
      const committed = await this.commitDivisionScoreboard(ctx, pointers);
      commits.push([division.id, committed]);
    }
    await this.emitEvents(commits);
    this.calculationState.recordSuccess({
      startedAt,
      eventTimestamp,
      nextVisibilityTime,
      coversAllDivisions,
      refreshedTeamTags,
    });
  }

  private async emitEvents(
    commits: [number, CommittedDivision][],
    dryRun = false,
  ) {
    let noSend = dryRun;
    if (this.notifiedSolves === null) {
      const bin = await this.dataLoader.getNotifiedSolves();
      if (bin) {
        this.notifiedSolves = roaring.RoaringBitmap32.deserialize(bin, false);
      } else {
        this.notifiedSolves = new roaring.RoaringBitmap32();
        noSend = true;
      }
    }

    const map = dryRun
      ? new roaring.RoaringBitmap32()
      : this.notifiedSolves.clone();
    const items: ChallengeSolveEvent[] = [];
    let hasNew = false;
    for (const [id, division] of commits) {
      for (const solves of division.challenges.values()) {
        for (const [idx, solve] of solves.solves.entries()) {
          if (!solve.hidden && !map.has(solve.id)) {
            map.add(solve.id);
            hasNew = true;
            if (!noSend) {
              items.push({ ...solve, seq: idx + 1, division_id: id });
            }
          }
        }
      }
    }
    if (items.length) {
      await this.eventBusService.publishBatch(ChallengeSolveEvent, items);
    }
    if (hasNew || noSend) {
      map.runOptimize();
      await this.dataLoader.saveNotifiedSolves(map.serialize(false) as Buffer);
      this.notifiedSolves = map;
    }
  }

  async recomputeFullGraph(eventTimestamp?: Date) {
    const startedAt = Date.now();
    const {
      challenges,
      teams,
      divisions,
      nextVisibilityTime,
      coversAllDivisions,
      refreshedTeamTags,
      setup,
    } = await this.fetchScoreboardCalculationParams(eventTimestamp, true);

    const points: HistoryDataPoint[] = [];
    const commits: [number, CommittedDivision][] = [];
    for (const { division, pointers } of divisions) {
      const id = division.id;
      const ctx = await this.fetchDivisionContext(
        teams.get(id) || [],
        challenges,
        id,
        setup,
      );
      const solvesByChallenge = PartitionSolvesByChallenge(
        ctx.solves,
        ctx.setup,
      );
      points.push(
        ...ComputeFullGraph(
          new Map(ctx.teams.map((x) => [x.id, x])),
          ctx.challenges,
          solvesByChallenge,
          ctx.awards,
        ),
      );

      const committed = await this.commitDivisionScoreboard(ctx, pointers);
      commits.push([id, committed]);
    }
    await this.history.replaceAll(
      points,
      divisions.map(({ division: { id } }) => id),
    );

    // Replace the notified bitmap only after the rebuilt state is persisted.
    await this.emitEvents(commits, true);
    this.calculationState.recordSuccess({
      startedAt,
      eventTimestamp,
      nextVisibilityTime,
      coversAllDivisions,
      refreshedTeamTags,
    });
  }

  private async commitDivisionScoreboard(
    ctx: DivisionContext,
    currentPointers: Record<string, number>,
  ): Promise<CommittedDivision> {
    const { division_id: id, teams, setup } = ctx;

    const targetPointers = this.getTargetPointers(setup);
    const prevVersions = Object.values(currentPointers).filter(Boolean);
    const activeVersions = new Set<number>();

    let latest: CommittedDivision | undefined;

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

      const res = await this.commitDivisionForPointer(
        ctx,
        target,
        currentPointers.latest,
      );
      if (target.cutoff) {
        // Record the frozen endpoint even if pre-cutoff solves were processed late.
        await this.history.saveIteration(
          id,
          res.scoreboard,
          teams.filter((t) => t.flags.includes("hidden")).map((t) => t.id),
          true,
        );
      }
      activeVersions.add(res.version);
      if (target.name === "latest") {
        latest = res;
      }
    }

    if (latest && latest.scoreboard.length) {
      await this.history.saveIteration(
        id,
        latest.scoreboard,
        teams.filter((t) => t.flags.includes("hidden")).map((t) => t.id),
      );
    }

    // Expire unused versions somewhat eagerly (with a small grace period)
    const toExpire = prevVersions.filter((v) => !activeVersions.has(v));
    await this.dataLoader.expireVersions(id, toExpire, 10);
    return latest!; // latest always exists
  }

  private async fetchDivisionContext(
    teams: MinimalTeamInfo[],
    challenges: ChallengeMetadataWithExpr[],
    id: number,
    setup: SetupConfig,
  ): Promise<DivisionContext> {
    const [solves, awards] = await Promise.all([
      this.submissionDAO.getSolvesForCalculation(id),
      this.awardDAO.getAllAwards(id),
    ]);
    return {
      division_id: id,
      teams,
      challenges,
      solves,
      awards,
      setup,
    };
  }

  private async commitDivisionForPointer(
    ctx: DivisionContext,
    target: PointerTarget,
    previousVersion = 0,
  ): Promise<CommittedDivision> {
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
        entry.updated_at = target.cutoff;
        if (entry.last_solve > target.cutoff) {
          entry.last_solve = target.cutoff;
        }
      }
    }

    // Publication generations must advance even when a deletion removes the
    // newest event. Live history and its API cutoff share this timestamp.
    const version = computeSnapshotVersion(
      target.cutoff,
      previousVersion,
      last_event.getTime(),
      ctx.setup.freeze_time_s,
    );
    if (!target.cutoff) {
      for (const entry of scoreboard) entry.updated_at = new Date(version);
    }

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
