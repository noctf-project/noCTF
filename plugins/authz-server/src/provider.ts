import { ServiceCradle } from "@noctf/server-core";
import { AuthzServerConfig } from "./schema/config.ts";
import { nanoid } from "nanoid";

interface AuthorizationCodeContext {
  userId: number;
  clientId: string;
  scope: string;
}

const DEFAULT_EXPIRY_SECONDS = 5 * 60;
const CACHE_NAMESPACE = "plugin:authz_server";

export class OAuthProvider {
  constructor(
    private cacheService: ServiceCradle["cacheService"],
    private configService: ServiceCradle["configService"],
    private identityService: ServiceCradle["identityService"],
  ) {}

  async getClient(clientId: string) {
    const {
      value: { clients },
    } = await this.configService.get<AuthzServerConfig>(AuthzServerConfig.$id);
    return clients.find(({ client_id }) => client_id === clientId);
  }

  async validateClient(clientId: string, redirectUri: string) {
    const client = await this.getClient(clientId);
    if (!client) {
      return false;
    }
    return !!client.redirect_uri.find((r) => r === redirectUri);
  }

  generateAuthorizationCode(userId: number, clientId: string, scope: string) {
    const code = nanoid();
    this.cacheService.put(
      CACHE_NAMESPACE,
      `code:${code}`,
      {
        userId,
        clientId,
        scope,
      },
      DEFAULT_EXPIRY_SECONDS,
    );
    return code;
  }

  async validateTokenRequest(
    clientId: string,
    clientSecret: string,
    code: string,
    redirectUri: string,
  ) {
    if (!(await this.validateClient(clientId, redirectUri))) {
      return false;
    }
    if ((await this.getClient(clientId))?.client_secret !== clientSecret) {
      return false;
    }
    return !!(await this.cacheService.get<AuthorizationCodeContext>(
      CACHE_NAMESPACE,
      `code:${code}`,
    ));
  }

  async exchangeAuthorizationCodeForToken(code: string) {
    const authorizationCodeContext =
      await this.cacheService.get<AuthorizationCodeContext>(
        CACHE_NAMESPACE,
        `code:${code}`,
      );
    if (!authorizationCodeContext) {
      return undefined;
    }
    await this.cacheService.del(CACHE_NAMESPACE, `code:${code}`);
    const token = this.identityService.generateToken({
      aud: "scoped",
      sub: authorizationCodeContext.userId,
      scopes: [authorizationCodeContext.scope],
    });
    return token;
  }
}
