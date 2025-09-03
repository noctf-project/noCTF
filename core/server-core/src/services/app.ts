import { nanoid } from "nanoid";
import { AppDAO, CreateUpdateAppData, DBApp } from "../dao/app.ts";
import { ServiceCradle } from "../index.ts";
import { createHash, createHmac } from "node:crypto";
import { BadRequestError, ForbiddenError } from "../errors.ts";
import type { AuditParams } from "../types/audit_log.ts";
import { EntityType } from "../types/enums.ts";

type Props = Pick<
  ServiceCradle,
  | "cacheService"
  | "lockService"
  | "identityService"
  | "databaseClient"
  | "auditLogService"
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
  private readonly auditLogService;
  private readonly appDAO;

  constructor({
    cacheService,
    identityService,
    lockService,
    databaseClient,
    auditLogService,
  }: Props) {
    this.cacheService = cacheService;
    this.identityService = identityService;
    this.lockService = lockService;
    this.auditLogService = auditLogService;
    this.appDAO = new AppDAO(databaseClient.get());
  }

  async generateAuthorizationCode(
    app: DBApp,
    redirect_uri: string,
    user_id: number,
    scopes: string[],
  ) {
    if (!app.client_secret_hash)
      throw new BadRequestError(
        "NoCodeFlow",
        "App does not support authorization code flow",
      );

    const appScopes = new Set(["openid", ...app.scopes]);
    if (new Set(scopes).difference(appScopes).size > 0)
      throw new ForbiddenError(
        "App is not configured for all the requested scopes",
      );

    const code = nanoid();
    const signed = AppService.signCode(
      app.client_id,
      app.client_secret_hash,
      code,
    );
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
    const signed = AppService.signCode(
      client_id,
      // no salt needed since these are effectively random since they're generated
      // by the server
      createHash("sha256").update(client_secret).digest(),
      code,
    );
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
          throw new BadRequestError("invalid_redirect_uri");
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

  async list(): Promise<DBApp[]> {
    return await this.appDAO.list();
  }

  async create(
    data: Omit<CreateUpdateAppData, "client_secret_hash">,
    { actor, message }: AuditParams = {},
  ): Promise<{ app: DBApp; client_secret: string }> {
    const client_secret = nanoid();
    const client_secret_hash = createHash("sha256")
      .update(client_secret)
      .digest();

    const createData: CreateUpdateAppData = {
      ...data,
      client_secret_hash,
    };

    const app = await this.appDAO.create(createData);

    await this.auditLogService.log({
      operation: "app.create",
      actor,
      entities: [`${EntityType.APP}:${app.id}`],
      data: message,
    });

    return { app, client_secret };
  }

  async update(
    id: number,
    data: Omit<CreateUpdateAppData, "client_secret_hash"> & {
      client_secret?: "refresh";
    },
    { actor, message }: AuditParams = {},
  ): Promise<{ app: DBApp; client_secret?: string }> {
    const { client_secret, ...rest } = data;

    const updateData: CreateUpdateAppData = rest;
    let newClientSecret: string | undefined;

    if (client_secret === "refresh") {
      newClientSecret = nanoid();
      updateData.client_secret_hash = createHash("sha256")
        .update(newClientSecret)
        .digest();
    }

    const app = await this.appDAO.update(id, updateData);

    await this.auditLogService.log({
      operation:
        client_secret === "refresh" ? "app.refresh_secret" : "app.update",
      actor,
      entities: [`${EntityType.APP}:${app.id}`],
      data: message,
    });

    return { app, client_secret: newClientSecret };
  }

  async delete(
    id: number,
    { actor, message }: AuditParams = {},
  ): Promise<void> {
    await this.appDAO.delete(id);

    await this.auditLogService.log({
      operation: "app.delete",
      actor,
      entities: [`${EntityType.APP}:${id}`],
      data: message,
    });
  }

  private static signCode(
    client_id: string,
    client_secret: Buffer,
    code: string,
  ) {
    const signed = createHmac("sha256", client_secret)
      .update(client_id)
      .digest();
    return createHmac("sha256", signed).update(code).digest("base64url");
  }
}
