import { RegisterTokenData } from "@noctf/api/token";
import { ServiceCradle } from "@noctf/server-core";
import { ForbiddenError } from "@noctf/server-core/errors";
import { createHash, randomUUID } from "node:crypto";

type Props = Pick<ServiceCradle, "cacheService">;

export type StateTokenData = {
  name: string;
};

type TokenDataMap = {
  register: RegisterTokenData;
  associate: RegisterTokenData;
  change: RegisterTokenData;
  state: StateTokenData;
};

const TOKEN_EXPIRY_SECONDS: Record<keyof TokenDataMap, number> = {
  register: 3600,
  associate: 3600,
  change: 3600,
  state: 600,
};

const CACHE_NAMESPACE = "core:auth:token";

export class TokenProvider {
  private readonly cacheService;

  constructor({ cacheService }: Props) {
    this.cacheService = cacheService;
  }

  async lookup<T extends keyof TokenDataMap>(
    type: T,
    token: string,
  ): Promise<TokenDataMap[T]> {
    const hash = TokenProvider.hash(token);
    const result = await this.cacheService.get<TokenDataMap[T]>(
      CACHE_NAMESPACE,
      `${type}:${hash}`,
    );
    if (!result) throw new ForbiddenError("Invalid token");
    return result;
  }

  async create<T extends keyof TokenDataMap>(
    type: T,
    data: TokenDataMap[T],
  ): Promise<string> {
    const token = randomUUID();
    const hash = TokenProvider.hash(token);
    await this.cacheService.put(
      CACHE_NAMESPACE,
      `${type}:${hash}`,
      data,
      TOKEN_EXPIRY_SECONDS[type],
    );
    return token;
  }

  async invalidate(type: keyof TokenDataMap, token: string) {
    const hash = TokenProvider.hash(token);
    const result = await this.cacheService.del(
      CACHE_NAMESPACE,
      `${type}:${hash}`,
    );
    if (!result) throw new ForbiddenError("Token already revoked");
  }

  static hash(token: string) {
    return createHash("sha256").update(token, "utf-8").digest("base64url");
  }
}
