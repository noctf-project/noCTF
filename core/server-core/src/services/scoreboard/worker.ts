import { ChallengeUpdateEvent, SubmissionUpdateEvent } from "@noctf/api/events";
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
  timestamp?: Date,
) => {
  await lockService.withLease(`singleton:scoreboard`, () =>
    scoreboardService.computeAndSaveScoreboards(timestamp),
  );
};

export const ScoreboardCalculatorWorker = async (
  signal: AbortSignal,
  c: Props,
) => {
  await c.eventBusService.subscribe<SubmissionUpdateEvent>(
    signal,
    "ScoreboardWorker",
    [SubmissionUpdateEvent.$id!, ChallengeUpdateEvent.$id!],
    {
      concurrency: 1,
      handler: async (data) => {
        let updated_at = new Date(data.timestamp);
        if (data.data.updated_at) updated_at = data.data.updated_at;
        await RunLockedScoreboardCalculator(c, updated_at);
      },
    },
  );
};
