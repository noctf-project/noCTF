import { AuthMethod } from "@noctf/api/datatypes";
import { AuthToken } from "@noctf/api/token";
import { IdentityProvider } from "@noctf/server-core/types/identity";
import { NotFoundError, AuthenticationError } from "@noctf/server-core/errors";
import { get } from "@noctf/server-core/util/object";
import { AuthConfig } from "@noctf/api/config";
import { CACHE_NAMESPACE } from "./const.ts";
import { ServiceCradle } from "@noctf/server-core";

type StateToken = {
  name: string;
  jti: string;
};

export const TOKEN_AUDIENCE = "noctf/auth/oauth/state";

export class OAuthConfigProvider {
  constructor(
    private configService: ServiceCradle["configService"],
    private cacheService: ServiceCradle["cacheService"],
    private databaseClient: ServiceCradle["databaseClient"],
  ) {}

  private async isEnabled(): Promise<boolean> {
    return !!(await this.configService.get<AuthConfig>(AuthConfig.$id)).value
      .enable_oauth;
  }

  async listMethods(): Promise<AuthMethod[]> {
    if (!(await this.isEnabled())) {
      return [];
    }
    return await this.cacheService.load(
      `${CACHE_NAMESPACE}:oauth:methods`,
      () => this._queryMethods(),
    );
  }

  private async _queryMethods(): Promise<AuthMethod[]> {
    const methods = await this.databaseClient
      .selectFrom("core.oauth_provider")
      .where("is_enabled", "=", true)
      .select(["name", "image_src"])
      .execute();

    return methods.map(({ name, image_src }) => ({
      provider: this.id(),
      name,
      image_src: image_src || undefined,
    }));
  }

  async getMethod(provider: string) {
    if (!(await this.isEnabled())) {
      throw new NotFoundError("The requested auth provider cannot be found");
    }

    return await this.cacheService.load(
      `${CACHE_NAMESPACE}:oauth:method:${provider}`,
      () => this._queryMethod(provider),
    );
  }

  private async _queryMethod(provider: string) {
    const data = await this.databaseClient
      .selectFrom("core.oauth_provider")
      .where("is_enabled", "=", true)
      .where("name", "=", provider)
      .select([
        "is_registration_enabled",
        "client_id",
        "client_secret",
        "authorize_url",
        "token_url",
        "info_url",
        "info_id_property",
      ])
      .executeTakeFirst();
    if (!data) {
      throw new NotFoundError("The requested auth provider cannot be found");
    }

    return data;
  }

  id() {
    return "oauth";
  }
}

export class OAuthIdentityProvider implements IdentityProvider {
  constructor(
    private configProvider: OAuthConfigProvider,
    private identityService: ServiceCradle["identityService"],
    private tokenService: ServiceCradle["tokenService"],
  ) {}

  async listMethods(): Promise<AuthMethod[]> {
    return this.configProvider.listMethods();
  }

  async authenticate(
    state: string,
    code: string,
    redirect_uri: string,
  ): Promise<AuthToken> {
    const { name } = await this.validateState(state);

    const method = await this.configProvider.getMethod(name);
    const id = await this.getExternalId(method, code, redirect_uri);
    const identity = await this.identityService.getIdentityForProvider(
      `${this.id()}:${name}`,
      id,
    );
    if (!identity) {
      if (method.is_registration_enabled) {
        return {
          aud: "register",
          identity: [
            {
              provider: `${this.id()}:${name}`,
              provider_id: id,
            },
          ],
        };
      } else {
        throw new AuthenticationError(
          "New user registration is currently not available through this provider",
        );
      }
    }
    return {
      aud: "session",
      sub: identity.user_id,
    };
  }

  async associate(
    user_id: number,
    state: string,
    code: string,
    redirect_uri: string,
  ) {
    const { name } = await this.validateState(state);
    const method = await this.configProvider.getMethod(name);
    const provider_id = await this.getExternalId(method, code, redirect_uri);
    await this.identityService.associateIdentity({
      user_id,
      provider: `${this.id()}:${name}`,
      provider_id,
      secret_data: null,
    });
  }

  private async validateState(state: string) {
    return this.tokenService.validate(
      state,
      TOKEN_AUDIENCE,
    ) as Promise<StateToken>;
  }

  async generateAuthoriseUrl(name: string) {
    const { authorize_url, client_id } =
      await this.configProvider.getMethod(name);
    const url = new URL(authorize_url);
    url.searchParams.set("client_id", client_id);
    url.searchParams.set("response_type", "code");
    url.searchParams.set(
      "state",
      this.tokenService.sign(
        {
          name,
        } as StateToken,
        TOKEN_AUDIENCE,
        5 * 60,
      ),
    );
    return url.toString();
  }

  async getExternalId(
    {
      client_id,
      client_secret,
      token_url,
      info_url,
      info_id_property,
    }: Awaited<ReturnType<OAuthConfigProvider["getMethod"]>>,
    code: string,
    redirect_uri: string,
  ): Promise<string> {
    const tokenResponse = await fetch(token_url, {
      method: "POST",
      body: new URLSearchParams({
        client_id,
        client_secret,
        redirect_uri,
        grant_type: "authorization_code",
        code,
      }),
    });
    if (!tokenResponse.ok) {
      throw new AuthenticationError("Could not exchange code for access_token");
    }
    const token = (await tokenResponse.json()).access_token;

    const infoResponse = await fetch(info_url, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    if (!infoResponse.ok) {
      throw new AuthenticationError(
        "Could not get user information from provider",
      );
    }

    const info = await infoResponse.json();
    return get(info, info_id_property || "id");
  }

  id() {
    return this.configProvider.id();
  }
}
