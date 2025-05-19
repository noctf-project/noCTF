import { initWorker as initTickets } from "@noctf/mod-tickets";
import { server } from "../index.ts";
import { WorkerRegistry } from "@noctf/server-core/worker/registry";
import { SignalledWorker } from "@noctf/server-core/worker/signalled";
import {
  RunLockedScoreboardCalculator,
  ScoreboardCalculatorWorker,
} from "@noctf/server-core/services/scoreboard/worker";
import { SingletonWorker } from "@noctf/server-core/worker/singleton";

server.ready(async () => {
  const { logger, emailService, lockService } = server.container.cradle;
  const registry = new WorkerRegistry(server.container.cradle.logger);

  registry.register(
    new SignalledWorker({
      name: "queue.tickets",
      handler: (signal) => initTickets(signal, server.container.cradle),
      logger,
    }),
  );
  registry.register(
    new SignalledWorker({
      name: "email_sender",
      handler: (signal) => emailService.worker(signal),
      logger,
    }),
  );

  registry.register(
    new SingletonWorker({
      lockService: lockService,
      logger: logger,
      intervalSeconds: 120,
      name: "scoreboard_periodic",
      handler: () => RunLockedScoreboardCalculator(server.container.cradle),
    }),
  );
  registry.register(
    new SignalledWorker({
      name: "scoreboard_event",
      handler: (signal) =>
        ScoreboardCalculatorWorker(signal, server.container.cradle),
      logger,
    }),
  );
  await registry.run();

  // TODO: graceful shutdown
});
