import {
  ChallengeUpdateEvent,
  ScoreboardTriggerEvent,
  ConfigUpdateEvent,
  TeamUpdateEvent,
} from "@noctf/api/events";
import { ServiceCradle } from "../../index.ts";

type Props = Pick<
  ServiceCradle,
  "scoreboardService" | "eventBusService" | "lockService"
>;

export const RunLockedScoreboardCalculator = async (
  {
    lockService,
    scoreboardService,
  }: Pick<ServiceCradle, "lockService" | "scoreboardService">,
  {
    updated_at,
    recompute_graph,
  }: { updated_at?: Date; recompute_graph?: boolean } = {},
) => {
  await lockService.withLease(`singleton:scoreboard`, () => {
    if (recompute_graph) {
      return scoreboardService.recomputeFullGraph();
    }
    return scoreboardService.computeAndSaveScoreboards(updated_at);
  });
};

export const ScoreboardCalculatorWorker = async (
  signal: AbortSignal,
  c: Props,
) => {
  await c.eventBusService.subscribe<
    ChallengeUpdateEvent | ScoreboardTriggerEvent | ConfigUpdateEvent
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
          return await RunLockedScoreboardCalculator(c, {
            recompute_graph: (data.data as ScoreboardTriggerEvent)
              .recompute_graph,
          });
        }
        if (data.subject === ConfigUpdateEvent.$id!) {
          const cfg = data.data as ConfigUpdateEvent;
          if (cfg.namespace === "setup") {
            return await RunLockedScoreboardCalculator(c, {
              updated_at: cfg.updated_at,
            });
          }
          return;
        }
        let updated_at = new Date(data.timestamp);
        if (
          data.subject === ChallengeUpdateEvent.$id! ||
          data.subject === TeamUpdateEvent.$id!
        ) {
          if ("updated_at" in data.data && data.data.updated_at) {
            updated_at = data.data.updated_at;
          }
        }

        await RunLockedScoreboardCalculator(c, { updated_at });
      },
    },
  );
};
