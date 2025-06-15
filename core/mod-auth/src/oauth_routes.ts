import {
  FinishAuthOauthRequest,
  InitAuthOauthRequest,
  OAuthTokenRequest,
} from "@noctf/api/requests";
import {
  FinishAuthResponse,
  InitAuthOauthResponse,
  BaseResponse,
  OAuthAuthorizeResponse,
  OAuthTokenResponse,
  OAuthConfigurationResponse,
} from "@noctf/api/responses";
import { NoResultError } from "kysely";
import {
  OAuthConfigProvider,
  OAuthIdentityProvider,
} from "./oauth_client_provider.ts";
import type { FastifyInstance } from "fastify";
import { TokenProvider } from "./token_provider.ts";
import { BadRequestError, NotFoundError } from "@noctf/server-core/errors";
import { OAuthAuthorizeQuery } from "@noctf/api/query";
import { SetupConfig } from "@noctf/api/config";
import fastifyFormbody from "@fastify/formbody";
import { JWK, SignJWT } from "jose";
import { nanoid } from "nanoid";
import { JWKSStore } from "./oauth_jwks.ts";

enum ResponseType {
  CODE = "code",
  ID_TOKEN = "id_token",
}
const VALID_RESPONSE_TYPES = new Set(Object.values(ResponseType));

export default async function (fastify: FastifyInstance) {
  const {
    identityService,
    configService,
    appService,
    cacheService,
    databaseClient,
    userService,
    keyService,
    teamService,
  } = fastify.container.cradle;
  const configProvider = new OAuthConfigProvider(
    configService,
    cacheService,
    databaseClient,
  );
  const provider = new OAuthIdentityProvider(
    configProvider,
    identityService,
    new TokenProvider({ cacheService }),
  );
  const jwksStore = new JWKSStore(keyService);

  identityService.register(provider);
  fastify.register(fastifyFormbody);

  const signIdToken = async (clientId: string, userId: number) => {
    const membership = await teamService.getMembershipForUser(userId);
    const user = await userService.get(userId);
    const key = await jwksStore.getSigningKey();

    return await new SignJWT({
      "noctf.dev/team_id": membership?.team_id.toString(),
      "noctf.dev/division_id": membership?.division_id.toString(),
      roles: user.roles,
      name: user.name,
    })
      .setProtectedHeader({ alg: "EdDSA", kid: key.pub.kid })
      .setIssuedAt()
      .setExpirationTime("1h")
      .setJti(nanoid())
      .setIssuer(fastify.apiURL)
      .setAudience(clientId)
      .setSubject(userId.toString())
      .sign(key.secret);
  };

  fastify.get<{ Reply: OAuthConfigurationResponse }>(
    "/.well-known/openid-configuration",
    async () => {
      const host = fastify.apiURL;
      return {
        issuer: host,
        authorization_endpoint: new URL(
          "/auth/oauth/authorize",
          host,
        ).toString(),
        token_endpoint: new URL("/auth/oauth/token", host).toString(),
        response_types_supported: ["code", "token"],
        id_token_signing_alg_values_supported: ["Ed25519"],
      };
    },
  );

  fastify.get<{ Reply: { keys: JWK[] } }>("/auth/oauth/jwks", async () => {
    return { keys: await jwksStore.getPublicKeys() };
  });

  fastify.post<{
    Body: InitAuthOauthRequest;
    Reply: InitAuthOauthResponse | BaseResponse;
  }>(
    "/auth/oauth/init",
    {
      schema: {
        tags: ["auth"],
        body: InitAuthOauthRequest,
        response: {
          200: InitAuthOauthResponse,
          404: BaseResponse,
        },
      },
    },
    async (request) => {
      try {
        const url = await provider.generateAuthoriseUrl(request.body.name);
        return {
          data: url,
        };
      } catch (e) {
        if (e instanceof NoResultError) {
          throw new NotFoundError("OAuth Provider Not Found");
        }
        throw e;
      }
    },
  );

  fastify.post<{
    Body: FinishAuthOauthRequest;
    Response: FinishAuthResponse;
  }>(
    "/auth/oauth/finish",
    {
      schema: {
        tags: ["auth"],
        body: FinishAuthOauthRequest,
        response: {
          200: FinishAuthResponse,
        },
      },
    },
    async (request) => {
      const { state, code, redirect_uri } = request.body;
      return {
        data: await provider.authenticate(state, code, redirect_uri),
      };
    },
  );

  fastify.get<{ Querystring: OAuthAuthorizeQuery }>(
    "/auth/oauth/authorize",
    {
      schema: {
        tags: ["auth"],
        security: [{ bearer: [] }],
        querystring: OAuthAuthorizeQuery,
        response: {
          200: OAuthAuthorizeResponse,
          400: BaseResponse,
        },
      },
    },
    async (request, reply) => {
      const { client_id, redirect_uri, scope, state, response_type } =
        request.query;
      const userId = request.user?.id;

      if (!userId) {
        const config = await configService.get<SetupConfig>(SetupConfig.$id);
        const url = new URL(config.value.root_url);
        url.pathname = "/auth";
        url.searchParams.set("client_id", client_id);
        url.searchParams.set("redirect_uri", redirect_uri);
        url.searchParams.set("scope", scope);
        url.searchParams.set("state", state);
        return reply.redirect(url.toString());
      }
      const responseTypes = new Set(response_type.toLowerCase().split(" "));
      for (const t in responseTypes) {
        if (!VALID_RESPONSE_TYPES.has(t as ResponseType))
          throw new BadRequestError("InvalidResponseType");
      }
      if (responseTypes.size === 0) {
        throw new BadRequestError("NoResponseType");
      }
      const scopes = new Set(scope.toLowerCase().split(" "));

      const url = new URL(redirect_uri);
      url.searchParams.set("state", state);
      const app = await appService.getValidatedAppWithClientID(
        client_id,
        redirect_uri,
      );
      if (responseTypes.has(ResponseType.CODE)) {
        url.searchParams.set(
          "code",
          await appService.generateAuthorizationCode(
            app,
            redirect_uri,
            userId,
            [...scopes],
          ),
        );
        return { url };
      }

      let hasResponse = false;
      // Only return this if code is not specified (implicit)
      if (responseTypes.has(ResponseType.ID_TOKEN) && scopes.has("openid")) {
        url.searchParams.set("id_token", await signIdToken(client_id, userId));
        hasResponse = true;
      }
      if (!hasResponse) throw new BadRequestError("NoResponseType");
      return { url };
    },
  );

  fastify.post<{ Body: OAuthTokenRequest }>(
    "/auth/oauth/token",
    {
      schema: {
        tags: ["auth"],
        security: [{ bearer: [] }],
        body: OAuthTokenRequest,
        response: { 200: OAuthTokenResponse, 400: BaseResponse },
      },
    },
    async (request, reply) => {
      const authHeader = request.headers["authorization"];
      if (!authHeader || !authHeader.startsWith("Basic ")) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      const userPassB64 = Buffer.from(
        authHeader.substring(6),
        "base64",
      ).toString();
      const userPass = /^([^:]*):(.*)$/.exec(userPassB64);
      if (userPass === null) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      const clientId = userPass[1];
      const clientSecret = userPass[2];

      const { code, redirect_uri } = request.body;

      // TODO: refresh token
      try {
        const { result, scopes, user_id } =
          await appService.exchangeAuthorizationCodeForToken(
            clientId,
            clientSecret,
            redirect_uri,
            code,
          );
        if (scopes.includes("openid")) {
          return reply.send({
            ...result,
            id_token: signIdToken(clientId, user_id),
          });
        }
        reply.send(result);
      } catch (e) {
        if (e instanceof BadRequestError) {
          return reply.code(400).send({ error: "invalid_request" });
        }
        throw e;
      }
    },
  );
}
