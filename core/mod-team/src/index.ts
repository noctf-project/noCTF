import { ServiceCradle } from "@noctf/server-core";
import { FastifyInstance } from "fastify";
import { TeamConfig } from "@noctf/api/config";

export async function initServer(fastify: FastifyInstance) {
  const { configService } = fastify.container.cradle as ServiceCradle;
  await configService.register<TeamConfig>(TeamConfig, {
    allow_registration: true,
    allow_joining: true,
    restrict_valid_email: false,
  });
}
