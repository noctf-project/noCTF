import { nanoid } from "nanoid";
import { AppDAO } from "../dao/app.ts";
import { ServiceCradle } from "../index.ts";
import { createHmac } from "node:crypto";
import { BadRequestError } from "../errors.ts";
import { App } from "@noctf/api/datatypes";

type Props = Pick<
  ServiceCradle,
  "cacheService" | "lockService" | "identityService" | "databaseClient"
>;

export interface AuthorizationCodeContext {
  user_id: number;
  app_id: number;
  scopes: string[];
  redirect_uri: string;
}

export const CACHE_NAMESPACE = "core:svc:app";
export const DEFAULT_EXPIRY_SECONDS = 5 * 60;

export class AppService {
  private readonly cacheService;
  private readonly identityService;
  private readonly lockService;
  private readonly appDAO;

  constructor({
    cacheService,
    identityService,
    lockService,
    databaseClient,
  }: Props) {
    this.cacheService = cacheService;
    this.identityService = identityService;
    this.lockService = lockService;
    this.appDAO = new AppDAO(databaseClient.get());
  }

  async generateAuthorizationCode(
    app: App,
    redirect_uri: string,
    user_id: number,
    scopes: string[],
  ) {
    const code = nanoid();
    const signed = AppService.signCode(app.client_id, app.client_secret, code);
    await this.cacheService.put<AuthorizationCodeContext>(
      CACHE_NAMESPACE,
      `code:${signed}`,
      {
        user_id,
        app_id: app.id,
        scopes,
        redirect_uri,
      },
      DEFAULT_EXPIRY_SECONDS,
    );
    return code;
  }

  async exchangeAuthorizationCodeForToken(
    client_id: string,
    client_secret: string,
    redirect_uri: string,
    code: string,
  ) {
    const signed = AppService.signCode(client_id, client_secret, code);
    return await this.lockService.withLease(
      `${CACHE_NAMESPACE}:lock:${signed}`,
      async () => {
        const context = await this.cacheService.get<AuthorizationCodeContext>(
          CACHE_NAMESPACE,
          `code:${signed}`,
        );
        if (!context) {
          throw new BadRequestError("code_not_found");
        }
        if (context.redirect_uri !== redirect_uri) {
          throw new BadRequestError("inalid_redirect_uri");
        }

        await this.cacheService.del(CACHE_NAMESPACE, `code:${signed}`);
        return {
          scopes: context.scopes,
          user_id: context.user_id,
          result: await this.identityService.createSession(
            {
              user_id: context.user_id,
              scopes: context.scopes.filter((x) => x !== "refresh_token"),
              app_id: context.app_id,
            },
            context.scopes.some((x) => x === "refresh_token"),
          ),
        };
      },
    );
  }

  async getValidatedAppWithClientID(client_id: string, redirect_uri: string) {
    const app = await this.appDAO.getByActiveClientID(client_id);
    if (!app.redirect_uris.some((r) => r === redirect_uri)) {
      throw new BadRequestError("invalid_redirect_uri");
    }
    return app;
  }

  private static signCode(
    client_id: string,
    client_secret: string,
    code: string,
  ) {
    const signed = createHmac("sha256", client_secret)
      .update(client_id)
      .digest();
    return createHmac("sha256", signed).update(code).digest("base64url");
  }
}
