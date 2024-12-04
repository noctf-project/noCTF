import { ServiceCradle } from "@noctf/server-core";
import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";

const Config = Type.Object({
  allow_registration: Type.Boolean({
    title: "Allow self-service team registration",
  }),
  allow_joining: Type.Boolean({
    title:
      "Allow self-service team joining using join code. Will also allow users" +
      " to leave teams as long as there are no solves (WIP)",
  }),
  restrict_valid_email: Type.Boolean({
    title: "Only allow users with validated emails to register or join.",
  }),
});

export async function initServer(fastify: FastifyInstance) {
  const { configService } = fastify.container.cradle as ServiceCradle;
  await configService.register<Static<typeof Config>>("core.team", Config, {
    allow_registration: true,
    allow_joining: true,
    restrict_valid_email: false,
  });
}
