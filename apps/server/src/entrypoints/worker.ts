import { initWorker as initTickets } from "@noctf/mod-tickets";
import { server } from "../index.ts";
import { WorkerRegistry } from "@noctf/server-core/worker/registry";
import { SignalledWorker } from "@noctf/server-core/worker/signalled";
import { ScoreboardWorker } from "../workers/scoreboard.ts";

server.ready(async () => {
  const { logger, emailService } = server.container.cradle;
  const registry = new WorkerRegistry(server.container.cradle.logger);
  registry.register(ScoreboardWorker(server.container.cradle));
  registry.register(
    new SignalledWorker({
      name: "queue.tickets",
      handler: (signal) => initTickets(signal, server.container.cradle),
      logger,
    }),
  );
  registry.register(
    new SignalledWorker({
      name: "queue.email",
      handler: (signal) => emailService.worker(signal),
      logger,
    }),
  );
  await registry.run();

  // TODO: graceful shutdown
});
