import {
  AssociateTokenData,
  RegisterTokenData,
  ResetPasswordTokenData,
} from "@noctf/api/token";
import { ServiceCradle } from "../index.ts";
import { ForbiddenError } from "../errors.ts";
import { createHmac, randomUUID } from "node:crypto";

const CACHE_NAMESPACE = "core:svc:token";
type Props = Pick<ServiceCradle, "cacheService">;

export type StateTokenData = {
  name: string;
};

type TokenDataMap = {
  register: RegisterTokenData;
  reset_password: ResetPasswordTokenData;
  associate: AssociateTokenData;
  state: StateTokenData;
};

const TOKEN_EXPIRY_SECONDS: Record<keyof TokenDataMap, number> = {
  register: 3600,
  reset_password: 3600,
  associate: 3600,
  state: 600,
};

export class TokenService {
  private readonly cacheService;

  constructor({ cacheService }: Props) {
    this.cacheService = cacheService;
  }

  async lookup<T extends keyof TokenDataMap>(
    type: T,
    token: string,
  ): Promise<TokenDataMap[T]> {
    const hash = TokenService.hash(type, token);
    const result = await this.cacheService.get<TokenDataMap[T]>(
      CACHE_NAMESPACE,
      hash,
    );
    if (!result) throw new ForbiddenError("Invalid token");
    return result;
  }

  async create<T extends keyof TokenDataMap>(
    type: T,
    data: TokenDataMap[T],
  ): Promise<string> {
    const token = randomUUID();
    const hash = TokenService.hash(type, token);
    await this.cacheService.put(
      CACHE_NAMESPACE,
      hash,
      data,
      TOKEN_EXPIRY_SECONDS[type],
    );
    return token;
  }

  async invalidate(type: keyof TokenDataMap, token: string) {
    const hash = TokenService.hash(type, token);
    const result = await this.cacheService.del(CACHE_NAMESPACE, hash);
    if (!result) throw new ForbiddenError("Token already revoked");
  }

  static hash(type: string, token: string) {
    return createHmac("sha256", token).update(type).digest("base64url");
  }
}
