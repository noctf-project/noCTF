import { ServiceCradle } from "@noctf/server-core";
import { FastifyInstance } from "fastify";
import { AuthConfig, TeamConfig } from "@noctf/api/config";
import { AuthHook } from "@noctf/server-core/hooks/auth";
import { AuthzFlagHook } from "@noctf/server-core/hooks/authz";

declare module "fastify" {
  interface FastifySchema {
    tags?: string[];
    description?: string;
  }
}

export async function initServer(fastify: FastifyInstance) {
  const { configService } = fastify.container.cradle as ServiceCradle;
  await configService.register<TeamConfig>(TeamConfig, {
    allow_registration: true,
    allow_joining: true,
    restrict_valid_email: false,
  });

  fastify.addHook("preHandler", AuthHook());
  fastify.addHook(
    "preHandler",
    AuthzFlagHook(() =>
      configService
        .get<AuthConfig>(AuthConfig.$id)
        .then(
          ({ value: { validate_email } }) => validate_email && "valid_email",
        ),
    ),
  );

  // TODO
  fastify.post(
    "/team",
    {
      schema: {
        security: [{ bearer: [] }],
        tags: ["team"],
      },
    },
    async () => {
      return "good";
    },
  );
}
