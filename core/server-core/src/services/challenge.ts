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
  PublicChallenge,
} from "@noctf/api/datatypes";

type Props = Pick<
  ServiceCradle,
  "auditLogService" | "databaseClient" | "cacheService"
>;

const CACHE_NAMESPACE = "core:svc:challenge";
export class ChallengeService {
  private readonly auditLogService;
  private readonly cacheService;
  private readonly databaseClient;
  private readonly dao;

  constructor({ auditLogService, cacheService, databaseClient }: Props) {
    this.auditLogService = auditLogService;
    this.cacheService = cacheService;
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
    const { slug } = await this.dao.update(this.databaseClient.get(), id, v);
    await this.cacheService.del(CACHE_NAMESPACE, [
      `c:${id}`,
      `c:${slug}`,
      `m:${id}`,
      `m:${slug}`,
    ]);
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

  async get(idOrSlug: string | number, cached = false): Promise<Challenge> {
    if (cached) {
      return this.cacheService.load(CACHE_NAMESPACE, `c:${idOrSlug}`, () =>
        this.dao.get(this.databaseClient.get(), idOrSlug),
      );
    }
    return this.dao.get(this.databaseClient.get(), idOrSlug);
  }

  /**
   * Gets the metadata of a challenge. Always returns a cached response
   * @param idOrSlug ID Or Slug
   * @returns Challenge
   */
  async getMetadata(idOrSlug: string | number) {
    return this.cacheService.load(CACHE_NAMESPACE, `m:${idOrSlug}`, () =>
      this.get(idOrSlug).then((c) => ({
        id: c.id,
        slug: c.slug,
        private_metadata: c.private_metadata,
        visible_at: c.visible_at,
        hidden: c.hidden,
      })),
    );
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

  async getRendered(idOrSlug: string | number): Promise<PublicChallenge> {
    const c = await this.get(idOrSlug, true);
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
