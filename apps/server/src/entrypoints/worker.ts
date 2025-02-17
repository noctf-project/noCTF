import { initWorker as initTickets } from "@noctf/mod-tickets";
import { server } from "../index.ts";

server.ready(async () => {
  await initTickets(server.container.cradle);
  setInterval(
    () => server.container.cradle.scoreboardService.computeAndSaveScoreboards(),
    60000,
  );
});
