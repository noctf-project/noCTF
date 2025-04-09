import { ServiceCradle } from "@noctf/server-core";
import { SingletonWorker } from "@noctf/server-core/worker/singleton";

const SCOREBOARD_CALC_INTERVAL_SECONDS = 10;

type Props = Pick<
  ServiceCradle,
  "lockService" | "logger" | "scoreboardService"
>;
export const ScoreboardWorker = (c: Props) => {
  return new SingletonWorker({
    lockService: c.lockService,
    logger: c.logger,
    intervalSeconds: SCOREBOARD_CALC_INTERVAL_SECONDS,
    name: "scoreboard",
    handler: () => c.scoreboardService.computeAndSaveScoreboards(),
  });
};
