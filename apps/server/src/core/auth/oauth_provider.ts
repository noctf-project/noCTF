import { AuthMethod } from "@noctf/api/ts/datatypes";
import { IdentityProvider } from "@noctf/server-api/identity";
import { ConfigService } from "@noctf/services/config";
import { DatabaseService } from "@noctf/services/database";
import { get } from "@noctf/util";
import { CONFIG_NAMESPACE, Config } from "./config";
import { AuthProviderNotFound } from "@noctf/server-api/errors";

export class OAuthProvider implements IdentityProvider {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
  ) {}

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
      info_id_property,
    }: Awaited<ReturnType<OAuthProvider["getMethod"]>>,
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
      throw new Error("Could not exchange code for access_token");
    }
    const token = (await tokenResponse.json()).access_token;

    const infoResponse = await fetch(info_url, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    if (!infoResponse.ok) {
      throw new Error("Could not get user information from provider");
    }

    const info = await infoResponse.json();
    return get(info, info_id_property || "id");
  }

  private async isEnabled(): Promise<Boolean> {
    return !!(await this.configService.get<Config>(CONFIG_NAMESPACE))
      .enableOauth;
  }

  id() {
    return "oauth";
  }
}
