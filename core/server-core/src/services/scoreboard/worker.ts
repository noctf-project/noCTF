import {
  ChallengeUpdateEvent,
  SubmissionUpdateEvent,
  ScoreboardTriggerEvent,
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
    SubmissionUpdateEvent | ChallengeUpdateEvent
  >(
    signal,
    "ScoreboardWorker",
    [
      SubmissionUpdateEvent.$id!,
      ChallengeUpdateEvent.$id!,
      ScoreboardTriggerEvent.$id!,
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
        let updated_at = new Date(data.timestamp);
        if (data.data.updated_at) updated_at = data.data.updated_at;
        const sub = data.data as SubmissionUpdateEvent;
        if (
          data.subject === SubmissionUpdateEvent.$id! &&
          !sub.is_update &&
          sub.status !== "correct"
        )
          return;

        await RunLockedScoreboardCalculator(c, { updated_at });
      },
    },
  );
};
