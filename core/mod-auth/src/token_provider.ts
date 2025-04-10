import { RegisterTokenData } from "@noctf/api/token";
import { ServiceCradle } from "@noctf/server-core";
import { ForbiddenError } from "@noctf/server-core/errors";
import { createHash, randomUUID } from "node:crypto";

type Props = Pick<ServiceCradle, "cacheService">;

const CACHE_NAMESPACE = "core:auth:token";

export class TokenProvider {
  private readonly cacheService;

  constructor({ cacheService }: Props) {
    this.cacheService = cacheService;
  }

  async lookup(type: "register"|"associate", token: string): Promise<RegisterTokenData> {
    const hash = TokenProvider.hash(token);
    const result = await this.cacheService
      .get<RegisterTokenData>(CACHE_NAMESPACE,`${type}:${hash}`);
    if (!result) throw new ForbiddenError("Invalid token");
    return result;
  }

  async create(type: "register"|"associate", data: RegisterTokenData): Promise<string> {
    const token = randomUUID();
    const hash = TokenProvider.hash(token);
    await this.cacheService
      .put<RegisterTokenData>(CACHE_NAMESPACE,`${type}:${hash}`, data, 3600);
    return token;
  }

  async invalidate(type: "register"|"associate", token: string) {
    const hash = TokenProvider.hash(token);
    const result = await this.cacheService
      .del(CACHE_NAMESPACE,`${type}:${hash}`);
    if (!result) throw new ForbiddenError("Token already revoked");
  }

  private static hash(token: string) {
    return createHash("sha256").update(token, 'utf-8').digest('base64url');
  }
}