import { SetupConfig } from "@noctf/api/config";
import type { FastifyInstance } from "fastify";

// TODO
export async function routes(fastify: FastifyInstance) {
  const { configService } = fastify.container.cradle;
  await configService.register(
    SetupConfig,
    {
      initialized: false,
      active: false,
      name: "noCTF",
      root_url: "http://localhost:5173",
    },
    ({ initialized }) => {
      if (!initialized) {
        throw new Error("cannot set intialized to false");
      }
    },
  );
}
