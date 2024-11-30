import { AuthMethod, AuthTokenType } from "@noctf/api/ts/datatypes";
import { AuthResult, IdentityProvider } from "@noctf/server-api/identity";
import { ConfigService } from "@noctf/services/config";
import { DatabaseService } from "@noctf/services/database";
import { get } from "@noctf/util";
import { CONFIG_NAMESPACE, Config } from "./config.ts";
import {
  AuthProviderNotFound,
  AuthenticationError,
} from "@noctf/server-api/errors";
import { IdentityService } from "@noctf/services/identity";
import { TokenService } from "@noctf/services/token";

// TODO
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
type StateToken = {
  ip: string;
  name: string;
};

export class OAuthConfigProvider {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
  ) {}

  private async isEnabled(): Promise<boolean> {
    return !!(await this.configService.get<Config>(CONFIG_NAMESPACE))
      .enableOauth;
  }

  async listMethods(): Promise<AuthMethod[]> {
    if (!(await this.isEnabled())) {
      return [];
    }

    const methods = await this.databaseService
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
      throw new AuthProviderNotFound();
    }

    const data = await this.databaseService
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
      throw new AuthProviderNotFound();
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
    private identityService: IdentityService,
    private tokenService: TokenService,
  ) {}

  async listMethods(): Promise<AuthMethod[]> {
    return this.configProvider.listMethods();
  }

  async authenticate(
    name: string,
    code: string,
    redirect_uri: string,
  ): Promise<[AuthTokenType, AuthResult]> {
    const method = await this.configProvider.getMethod(name);
    const id = await this.getExternalId(method, code, redirect_uri);
    const identity = await this.identityService.getIdentityForProvider(
      `${this.id()}:${name}`,
      id,
    );
    if (!identity) {
      if (method.is_registration_enabled) {
        return [
          "register",
          [
            {
              provider: `${this.id()}:${name}`,
              provider_id: id,
            },
          ],
        ];
      } else {
        throw new AuthenticationError(
          "New user registration is currently not available through this provider",
        );
      }
    }
    return [
      "auth",
      {
        user_id: identity.user_id,
      },
    ];
  }

  async associate(
    user_id: number,
    name: string,
    code: string,
    redirect_uri: string,
  ) {
    const method = await this.configProvider.getMethod(name);
    const provider_id = await this.getExternalId(method, code, redirect_uri);
    await this.identityService.associateIdentity({
      user_id,
      provider: `${this.id()}:${name}`,
      provider_id,
      secret_data: null,
    });
  }

  async generateAuthoriseUrl(name: string, ip: string) {
    const { authorize_url, client_id } =
      await this.configProvider.getMethod(name);
    const url = new URL(authorize_url);
    url.searchParams.set("client_id", client_id);
    url.searchParams.set("response_type", "code");
    url.searchParams.set(
      "state",
      this.tokenService.sign(
        "noctf/auth/oauth/state",
        {
          name,
          ip,
        },
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
    const tokenResponse = await await fetch(token_url, {
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
