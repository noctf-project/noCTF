import { NoResultError } from "kysely";
import {
  OAuthConfigProvider,
  OAuthIdentityProvider,
} from "./oauth_client_provider.ts";
import type { FastifyInstance } from "fastify";
import { BadRequestError, NotFoundError } from "@noctf/server-core/errors";
import { SetupConfig } from "@noctf/api/config";
import fastifyFormbody from "@fastify/formbody";
import { SignJWT } from "jose";
import { nanoid } from "nanoid";
import { JWKSStore } from "./oauth_jwks.ts";
import { route } from "@noctf/server-core/util/route";
import {
  FinishOAuth,
  GetOAuthConfiguration,
  GetOAuthJWKS,
  InitOAuth,
  OAuthAuthorize,
  OAuthAuthorizeInternal,
  CreateOAuthToken,
} from "@noctf/api/contract/mod_auth";

export default async function (fastify: FastifyInstance) {
  const {
    identityService,
    configService,
    appService,
    cacheService,
    databaseClient,
    userService,
    keyService,
    tokenService,
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
    tokenService,
  );
  const jwksStore = new JWKSStore(keyService);

  identityService.register(provider);
  fastify.register(fastifyFormbody);

  const apiURL = fastify.apiURL.replace(/\/*$/, "/");

  const signIdToken = async (clientId: string, userId: number) => {
    const membership = await teamService.getMembershipForUser(userId);
    const user = await userService.get(userId);
    const key = await jwksStore.getKey();

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
      .setIssuer(apiURL)
      .setAudience(clientId)
      .setSubject(userId.toString())
      .sign(key.secret);
  };

  route(fastify, GetOAuthConfiguration, {}, async () => {
    return {
      issuer: apiURL,
      authorization_endpoint: new URL(
        "auth/oauth/authorize",
        apiURL,
      ).toString(),
      token_endpoint: new URL("auth/oauth/token", apiURL).toString(),
      jwks_uri: new URL("auth/oauth/jwks", apiURL).toString(),
      response_types_supported: ["code", "id_token token"],
      id_token_signing_alg_values_supported: ["EdDSA"],
    };
  });

  route(fastify, GetOAuthJWKS, {}, async () => {
    return { keys: [(await jwksStore.getKey()).pub] };
  });

  route(fastify, InitOAuth, {}, async (request) => {
    try {
      const data = await provider.generateAuthoriseUrl(request.body.name);
      return {
        data,
      };
    } catch (e) {
      if (e instanceof NoResultError) {
        throw new NotFoundError("OAuth Provider Not Found");
      }
      throw e;
    }
  });

  route(fastify, FinishOAuth, {}, async (request) => {
    const { state, code, redirect_uri } = request.body;
    return {
      data: await provider.authenticate(request.ip, state, code, redirect_uri),
    };
  });

  route(fastify, OAuthAuthorize, {}, async (request, reply) => {
    const config = await configService.get(SetupConfig);
    const url = new URL("auth/authorize", config.value.root_url);
    url.search = new URLSearchParams(
      request.query as Record<string, string>,
    ).toString();
    return reply.redirect(url.toString());
  });

  route(
    fastify,
    OAuthAuthorizeInternal,
    {
      auth: {
        require: true,
        policy: ["user.self.authorize"],
      },
    },
    async (request) => {
      const { response_type, scope, redirect_uri, state, client_id } =
        request.body;
      const responseSet = new Set([...response_type]);
      let url: URL;
      try {
        url = new URL(redirect_uri);
      } catch {
        throw new BadRequestError("Invalid redirect URI");
      }
      const app = await appService.getValidatedAppWithClientID(
        client_id,
        redirect_uri,
      );
      if (responseSet.symmetricDifference(new Set(["code"])).size === 0) {
        url.searchParams.set("state", state);
        url.searchParams.set(
          "code",
          await appService.generateAuthorizationCode(
            app,
            redirect_uri,
            request.user.id,
            scope,
          ),
        );
        return { data: { url: url.toString() } };
      } else if (
        responseSet.symmetricDifference(new Set(["id_token", "token"])).size ===
          0 &&
        scope.includes("openid")
      ) {
        const param = new URLSearchParams();
        param.set("id_token", await signIdToken(client_id, request.user.id));
        param.set("state", state);
        url.hash = param.toString();
        return { data: { url: url.toString() } };
      }
      throw new BadRequestError("NoResponseType");
    },
  );

  route(fastify, CreateOAuthToken, {}, async (request, reply) => {
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
          id_token: await signIdToken(clientId, user_id),
        });
      }
      reply.send(result);
    } catch (e) {
      if (e instanceof BadRequestError) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      throw e;
    }
  });
}
