import { initWorker as initTickets } from "@noctf/mod-tickets";
import { server } from "../index.ts";
import { WorkerRegistry } from "@noctf/server-core/worker/registry";
import { ScoreboardWorker } from "../workers/scoreboard.ts";

server.ready(async () => {
  await initTickets(server.container.cradle);
  const registry = new WorkerRegistry(server.container.cradle.logger);
  registry.register(ScoreboardWorker(server.container.cradle));
  await registry.run();

  // TODO: graceful shutdown
});
