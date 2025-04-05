import { initWorker as initTickets } from "@noctf/mod-tickets";
import { server } from "../index.ts";
import { Stopwatch } from "@noctf/server-core/util/stopwatch";

const SCOREBOARD_CALC_INTERVAL = 10000;

server.ready(async () => {
  await initTickets(server.container.cradle);
  const computeScoreboard = async () => {
    const stopwatch = new Stopwatch();
    try {
      await server.container.cradle.scoreboardService.computeAndSaveScoreboards();
    } catch (e) {
      server.log.error(e, "Error computing scoreboard");
    } finally {
      const elapsed = stopwatch.elapsed();
      const next = Math.max(0, SCOREBOARD_CALC_INTERVAL - elapsed);
      server.log.info({ elapsed, next }, "Scoreboard Calculation Time");
      setTimeout(computeScoreboard, next);
    }
  };
  setTimeout(computeScoreboard, SCOREBOARD_CALC_INTERVAL);
});
