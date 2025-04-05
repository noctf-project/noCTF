import { initWorker as initTickets } from "@noctf/mod-tickets";
import { server } from "../index.ts";
import { Stopwatch } from "@noctf/server-core/util/stopwatch";

server.ready(async () => {
  await initTickets(server.container.cradle);
  setInterval(
    async () => {
      const p = new Stopwatch();
      await server.container.cradle.scoreboardService.computeAndSaveScoreboards();
      server.log.info({elapsed: p.elapsed()}, "Scoreboard Elapsed");
    },
    60000,
  );
});
