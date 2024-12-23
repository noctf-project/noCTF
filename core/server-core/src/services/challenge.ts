import type {
  AdminCreateChallengeRequest,
  AdminUpdateChallengeRequest,
} from "@noctf/api/requests";
import { ChallengeDAO } from "../dao/challenge.ts";
import type { ServiceCradle } from "../index.ts";
import type { AuditLogActor } from "../types/audit_log.ts";
import type {
  Challenge,
  ChallengeSummary,
  RenderedChallenge,
} from "@noctf/api/datatypes";

type Props = Pick<
  ServiceCradle,
  "auditLogService" | "databaseClient" | "cacheService"
>;

export class ChallengeService {
  private readonly auditLogService;
  private readonly databaseClient;
  private readonly dao;

  constructor({ auditLogService, databaseClient }: Props) {
    this.auditLogService = auditLogService;
    this.databaseClient = databaseClient;
    this.dao = new ChallengeDAO();
  }

  async create(v: AdminCreateChallengeRequest, actor?: AuditLogActor) {
    const challenge = await this.dao.create(this.databaseClient.get(), v);
    await this.auditLogService.log({
      operation: "challenge.create",
      actor,
      entities: [`challenge:${challenge.id}`],
    });
    return challenge;
  }

  async update(
    id: number,
    v: AdminUpdateChallengeRequest,
    actor?: AuditLogActor,
  ) {
    await this.dao.update(this.databaseClient.get(), id, v);
    await this.auditLogService.log({
      operation: "challenge.update",
      actor,
      entities: [`challenge:${id}`],
    });
  }

  async list(
    query: Parameters<ChallengeDAO["list"]>[1],
    removePrivateTags = false,
  ): Promise<ChallengeSummary[]> {
    const summaries = await this.dao.list(this.databaseClient.get(), query);
    if (removePrivateTags) {
      return summaries.map((c) => {
        c.tags = this.removePrivateTags(c.tags);
        return c;
      });
    }
    return summaries;
  }

  async get<R extends boolean>(
    idOrSlug: string | number,
    render = false as R,
  ): Promise<R extends true ? RenderedChallenge : Challenge> {
    const result = await this.dao.get(this.databaseClient.get(), idOrSlug);
    if (render) {
      return (await this.render(result)) as R extends true
        ? RenderedChallenge
        : never;
    }
    return result as R extends true ? never : Challenge;
  }

  private removePrivateTags(tags: Record<string, string>) {
    return Object.keys(tags)
      .filter((t) => !t.startsWith("noctf:"))
      .reduce(
        (p, v) => {
          p[v] = v;
          return p;
        },
        {} as Record<string, string>,
      );
  }

  private async render(c: Challenge): Promise<RenderedChallenge> {
    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description,
      metadata: {}, // TODO
      hidden: c.hidden,
      visible_at: c.visible_at,
    };
  }
}
