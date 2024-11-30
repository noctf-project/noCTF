import { AuthMethod, AuthTokenType } from "@noctf/api/datatypes";
import {
  AuthResult,
  IdentityProvider,
} from "@noctf/server-core/providers/identity";
import { ConfigService } from "@noctf/server-core/services/config";
import { DatabaseService } from "@noctf/server-core/services/database";
import { get } from "@noctf/util";
import { CONFIG_NAMESPACE, Config } from "./config.ts";
import {
  AuthProviderNotFound,
  AuthenticationError,
} from "@noctf/server-core/errors";
import { IdentityService } from "@noctf/server-core/services/identity";
import { TokenService } from "@noctf/server-core/services/token";
import { nanoid } from "nanoid";

type StateToken = {
  name: string;
  nonce: string;
};

export const TOKEN_AUDIENCE = "noctf/auth/oauth/state";

export class OAuthConfigProvider {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
  ) {}

  private async isEnabled(): Promise<boolean> {
    return !!(await this.configService.get(CONFIG_NAMESPACE) as Config)
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
    state: string,
    code: string,
    redirect_uri: string,
  ): Promise<[AuthTokenType, AuthResult]> {
    const { name } = await this.validateState(state);

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
    const { dat } = this.tokenService.verify(state, TOKEN_AUDIENCE) as {
      dat: StateToken;
    };
    return dat;
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
          dat: {
            name,
            nonce: nanoid(),
          } as StateToken,
        },
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
