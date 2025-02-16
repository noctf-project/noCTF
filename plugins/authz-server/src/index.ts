import type { ServiceCradle } from "@noctf/server-core";
import type { FastifyInstance } from "fastify";
import "@noctf/server-core/types/fastify";
import { OAuthProvider } from "./provider.ts";
import { AuthorizeQuery, TokenRequest, TokenResponse } from "./schema/api.ts";
import { BaseResponse } from "@noctf/api/responses";
import fastifyFormbody from "@fastify/formbody";
import { AuthzServerConfig } from "./schema/config.ts";

// TODO: retrieve this from config somewhere
const WEB_URL = process.env.WEB_URL || "http://localhost:5173";

export async function initServer(fastify: FastifyInstance) {
  const { cacheService, configService, identityService } = fastify.container
    .cradle as ServiceCradle;

  fastify.register(fastifyFormbody);
  await configService.register(AuthzServerConfig, { clients: [] });

  const provider = new OAuthProvider(
    cacheService,
    configService,
    identityService,
  );

  fastify.get<{ Querystring: AuthorizeQuery }>(
    "/auth/oauth/authorize",
    {
      schema: {
        tags: ["authz_server"],
        security: [{ bearer: [] }],
        querystring: AuthorizeQuery,
        response: {
          302: {},
          400: BaseResponse,
        },
      },
    },
    async (request, reply) => {
      const { client_id, redirect_uri, scope, state } = request.query;
      const userId = request.user?.id;

      if (!userId) {
        const url = new URL(WEB_URL);
        url.pathname = "/auth";
        url.searchParams.set("client_id", client_id);
        url.searchParams.set("redirect_to", "api" + request.url);
        return reply.redirect(url.toString());
      }

      if (!(await provider.validateClient(client_id, redirect_uri))) {
        return reply.code(400).send({ error: "invalid_client" });
      }

      const code = provider.generateAuthorizationCode(userId, client_id, scope);
      const url = new URL(redirect_uri);
      url.searchParams.set("state", state);
      url.searchParams.set("code", code);

      return reply.redirect(url.toString());
    },
  );

  fastify.post<{ Body: TokenRequest }>(
    "/auth/oauth/token",
    {
      schema: {
        tags: ["authz_server"],
        security: [{ bearer: [] }],
        body: TokenRequest,
        response: { 200: TokenResponse, 400: BaseResponse },
      },
    },
    async (request, reply) => {
      const authHeader = request.headers["authorization"];
      if (!authHeader || !authHeader.startsWith("Basic ")) {
        return reply.code(400).send({ error: "invalid_client" });
      }
      const userPassB64 = Buffer.from(
        authHeader.substring(6),
        "base64",
      ).toString();
      const userPass = /^([^:]*):(.*)$/.exec(userPassB64);
      if (userPass === null) {
        return reply.code(400).send({ error: "invalid_client" });
      }
      const clientId = userPass[1];
      const clientSecret = userPass[2];

      const { code, redirect_uri } = request.body;
      if (
        !(await provider.validateTokenRequest(
          clientId,
          clientSecret,
          code,
          redirect_uri,
        ))
      ) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      const token = await provider.exchangeAuthorizationCodeForToken(code);
      if (!token) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      reply.send({ access_token: token });
    },
  );
}
