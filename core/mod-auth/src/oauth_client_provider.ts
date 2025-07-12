import type { AuthMethod } from "@noctf/api/datatypes";
import { NotFoundError, AuthenticationError } from "@noctf/server-core/errors";
import { get } from "@noctf/server-core/util/object";
import { AuthConfig } from "@noctf/api/config";
import { CACHE_NAMESPACE } from "./const.ts";
import type { ServiceCradle } from "@noctf/server-core";
import type { IdentityProvider } from "@noctf/server-core/services/identity";
import { UserNotFoundError } from "./error.ts";
import { FinishAuthResponse } from "@noctf/api/responses";
import { TokenService } from "@noctf/server-core/services/token";

export class OAuthConfigProvider {
  constructor(
    private configService: ServiceCradle["configService"],
    private cacheService: ServiceCradle["cacheService"],
    private databaseClient: ServiceCradle["databaseClient"],
  ) {}

  private async isEnabled(): Promise<boolean> {
    return !!(await this.configService.get(AuthConfig)).value.enable_oauth;
  }

  async listMethods(): Promise<AuthMethod[]> {
    if (!(await this.isEnabled())) {
      return [];
    }
    return await this.cacheService.load(CACHE_NAMESPACE, "oauth:methods", () =>
      this._queryMethods(),
    );
  }

  private async _queryMethods(): Promise<AuthMethod[]> {
    const methods = await this.databaseClient
      .get()
      .selectFrom("oauth_provider")
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
      CACHE_NAMESPACE,
      `oauth:method:${provider}`,
      () => this._queryMethod(provider),
    );
  }

  private async _queryMethod(provider: string) {
    const data = await this.databaseClient
      .get()
      .selectFrom("oauth_provider")
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
    private readonly configProvider: OAuthConfigProvider,
    private readonly identityService: ServiceCradle["identityService"],
    private readonly tokenService: TokenService,
  ) {}

  async listMethods(): Promise<AuthMethod[]> {
    return this.configProvider.listMethods();
  }

  async authenticate(
    ip: string,
    state: string,
    code: string,
    redirect_uri: string,
  ): Promise<FinishAuthResponse["data"]> {
    const data = await this.tokenService.lookup("state", state);
    const method = await this.configProvider.getMethod(data.name);
    const accessToken = await this.exchangeAccessToken(
      method,
      code,
      redirect_uri,
    );
    await this.tokenService.invalidate("state", state);
    const provider_id = await this.getExternalId(method, accessToken);
    console.log(provider_id, `${this.id()}:${data.name}`);
    const identity = await this.identityService.getIdentityForProvider(
      `${this.id()}:${data.name}`,
      provider_id,
    );
    if (!identity) {
      if (method.is_registration_enabled) {
        return {
          type: "register",
          token: await this.tokenService.create("register", {
            identity: [
              {
                provider: `${this.id()}:${data.name}`,
                provider_id,
              },
            ],
          }),
        };
      } else {
        throw new UserNotFoundError("User not found");
      }
    }
    return {
      type: "session",
      token: (
        await this.identityService.createSession({
          user_id: identity.user_id,
          ip,
        })
      ).access_token,
    };
  }

  async associate(
    user_id: number,
    state: string,
    code: string,
    redirect_uri: string,
  ) {
    const data = await this.tokenService.lookup("state", state);
    const method = await this.configProvider.getMethod(data.name);
    const accessToken = await this.exchangeAccessToken(
      method,
      code,
      redirect_uri,
    );
    await this.tokenService.invalidate("state", state);
    const provider_id = await this.getExternalId(method, accessToken);
    await this.identityService.associateIdentities([
      {
        user_id,
        provider: `${this.id()}:${data.name}`,
        provider_id,
        secret_data: null,
      },
    ]);
  }

  async generateAuthoriseUrl(name: string) {
    const { authorize_url, client_id } =
      await this.configProvider.getMethod(name);
    const state = await this.tokenService.create("state", {
      name,
    });
    const url = new URL(authorize_url);
    url.searchParams.set("client_id", client_id);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    return { url: url.toString(), state };
  }

  async exchangeAccessToken(
    {
      client_id,
      client_secret,
      token_url,
    }: Awaited<ReturnType<OAuthConfigProvider["getMethod"]>>,
    code: string,
    redirect_uri: string,
  ) {
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
    return (await tokenResponse.json()).access_token;
  }

  async getExternalId(
    {
      info_url,
      info_id_property,
    }: Awaited<ReturnType<OAuthConfigProvider["getMethod"]>>,
    access_token: string,
  ): Promise<string> {
    const infoResponse = await fetch(info_url, {
      headers: {
        authorization: `Bearer ${access_token}`,
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
