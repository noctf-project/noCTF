import { initWorker as initTickets } from "@noctf/mod-tickets";
import { server } from "../index.ts";
import { WorkerRegistry } from "@noctf/server-core/worker/registry";
import { SignalledWorker } from "@noctf/server-core/worker/signalled";
import { ScoreboardWorker } from "@noctf/server-core/services/scoreboard/worker";
import { SingletonWorker } from "@noctf/server-core/worker/singleton";

server.ready(async () => {
  const { logger, emailService, lockService, notificationService } =
    server.container.cradle;
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
      lockService,
      logger,
      intervalSeconds: 20,
      lockOptions: {
        leaseDurationSeconds: 60,
        renewIntervalSeconds: 10,
        maxFailedRenewAttempts: 3,
      },
      name: "scoreboard",
      handler: async (signal) => {
        const worker = new ScoreboardWorker(server.container.cradle);
        await worker.start(signal);
      },
    }),
  );

  registry.register(
    new SignalledWorker({
      name: "notification",
      handler: (signal) => notificationService.worker(signal),
      logger,
    }),
  );
  const shutdown = async () => {
    logger.info("Received termination signal, stopping workers...");
    registry.dispose();
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  await registry.run();
  await server.close();
  process.exit(0);
});
