import { AuthMethod } from "@noctf/api/ts/datatypes";
import { Service } from "../types";
import { AuthOauthFinishRequest, AuthOauthInitRequest } from "@noctf/api/ts/requests";
import {
  AuthOauthFinishRequest as AuthOauthFinishRequestJson
} from "@noctf/api/jsonschema/requests";
import { DatabaseService } from "@noctf/services/database";
import { AuthOauthInitResponse, ErrorResponse } from "@noctf/api/ts/responses";
import {
  AuthOauthInitResponse as AuthOauthInitResponseJson,
  ErrorResponse as ErrorResponseJson
} from "@noctf/api/jsonschema/responses";
import { NoResultError } from "kysely";
import { AuthProvider } from "@noctf/server-api/auth";

const get = (obj: any, path: string, defaultValue?: any) => {
  const travel = (regexp: RegExp) =>
    String.prototype.split
      .call(path, regexp)
      .filter(Boolean)
      .reduce((res: any, key: string) => (res !== null && res !== undefined ? res[key] : res), obj);
  const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);
  return result === undefined || result === obj ? defaultValue : result;
};

export class OAuthProvider implements AuthProvider {
  constructor(private databaseService: DatabaseService) {
  }

  async listMethods(): Promise<AuthMethod[]> {
    const methods = await this.databaseService
      .selectFrom('core.oauth_provider')
      .where('is_enabled', '=', true)
      .select(['name', 'image_src'])
      .execute();
    
    return methods.map(({ name, image_src }) => ({
      provider: this.id(),
      name,
      image_src: image_src || undefined
    }));
  }

  async getMethod(provider: string) {
    return await this.databaseService
      .selectFrom('core.oauth_provider')
      .where('is_enabled', '=', true)
      .where('name', '=', provider)
      .select([
        'is_registration_enabled',
        'client_id',
        'client_secret',
        'authorize_url',
        'token_url',
        'info_url',
        'info_id_property'
      ])
      .executeTakeFirstOrThrow();
  };

  async authenticate(name: string, code: string, redirect_uri: string) {
    const method = await this.getMethod(name);
    return await this.getExternalId(method, code, redirect_uri);
  }

  async getExternalId(
    {
      client_id,
      client_secret,
      token_url,
      info_url,
      info_id_property
    }: Awaited<ReturnType<OAuthProvider['getMethod']>>,
    code: string,
    redirect_uri: string
  ): Promise<string> {
    
    const tokenResponse = await (await fetch(token_url, {
      method: 'POST',
      body: new URLSearchParams({
        client_id,
        client_secret,
        redirect_uri,
        grant_type: 'authorization_code',
        code
      })
    }));
    if (!tokenResponse.ok) {
      throw new Error("Could not exchange code for access_token");
    }
    const token = (await tokenResponse.json()).access_token;


    const infoResponse = await fetch(info_url, {
      headers: {
        'authorization': `Bearer ${token}`
      }
    });
    if (!infoResponse.ok) {
      throw new Error("Could not get user information from provider");
    }

    const info = await infoResponse.json();
    return get(info, info_id_property || 'id');
  }

  id() {
    return 'oauth';
  }
}

export async function OAuthPlugin(fastify: Service) {
  const { authService, databaseService } = fastify.container.cradle;

  const provider = new OAuthProvider(databaseService);
  authService.register(provider);


  
  fastify.get<{
    Params: AuthOauthInitRequest,
    Reply: AuthOauthInitResponse | ErrorResponse
  }>('/auth/oauth/init/:name', {
    schema: {
      response: {
        200: AuthOauthInitResponseJson,
        404: ErrorResponseJson
      }
    }
  }, async (request, reply) => {
    try {
      const { authorize_url, client_id } = await provider.getMethod(request.params.name);
      const url = new URL(authorize_url);
      url.searchParams.set('client_id', client_id);
      return {
        data: url.toString()
      };
    } catch (e) {
      if (e instanceof NoResultError) {
        return reply.code(404).send({
          error: 'OAuth Provider Not Found'
        });
      }
      throw e;
    }
  });

  fastify.post<{
    Body: AuthOauthFinishRequest
  }>('/auth/oauth/finish', {
    schema: {
      body: AuthOauthFinishRequestJson
    }
  }, async (request, reply) => {
    const { name, code, redirect_uri } = request.body;
    return await provider.authenticate(name, code, redirect_uri);
  });
}