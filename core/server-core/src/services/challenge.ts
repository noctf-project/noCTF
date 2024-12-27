import type {
  AdminCreateChallengeRequest,
  AdminUpdateChallengeRequest,
} from "@noctf/api/requests";
import { ChallengeDAO } from "../dao/challenge.ts";
import type { ServiceCradle } from "../index.ts";
import type { AuditLogActor } from "../types/audit_log.ts";
import {
  ChallengePrivateMetadataBase,
  type Challenge,
  type ChallengeMetadata,
  type PublicChallenge,
} from "@noctf/api/datatypes";
import { Value } from "@sinclair/typebox/value";

type Props = Pick<
  ServiceCradle,
  "auditLogService" | "databaseClient" | "cacheService"
>;

const CACHE_NAMESPACE = "core:svc:challenge";
export class ChallengeService {
  private readonly auditLogService;
  private readonly cacheService;
  private readonly databaseClient;
  private readonly dao = new ChallengeDAO();

  constructor({ auditLogService, cacheService, databaseClient }: Props) {
    this.auditLogService = auditLogService;
    this.cacheService = cacheService;
    this.databaseClient = databaseClient;
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
    const { version } = await this.dao.update(this.databaseClient.get(), id, v);
    await this.cacheService.del(CACHE_NAMESPACE, [`c:${id}`, `m:${id}`]);
    await this.auditLogService.log({
      operation: "challenge.update",
      actor,
      entities: [`challenge:${id}`],
      data: `Updated to version ${version}`,
    });
    return version;
  }

  async list(
    query: Parameters<ChallengeDAO["list"]>[1],
    removePrivateTags = false,
  ): Promise<ChallengeMetadata[]> {
    const summaries = await this.dao.list(this.databaseClient.get(), query);
    if (removePrivateTags) {
      return summaries.map((c) => {
        c.tags = this.removePrivateTags(c.tags);
        return c;
      });
    }
    return summaries;
  }

  async get(id: number, cached = false): Promise<Challenge> {
    if (cached) {
      return this.cacheService.load(CACHE_NAMESPACE, `c:${id}`, () =>
        this.dao.get(this.databaseClient.get(), id),
      );
    }
    return this.dao.get(this.databaseClient.get(), id);
  }

  /**
   * Gets the metadata of a challenge. Always returns a cached response
   * @param id ID Or Slug
   * @returns Challenge
   */
  async getMetadata(id: number) {
    return this.cacheService.load(CACHE_NAMESPACE, `m:${id}`, () =>
      this.dao.getMetadata(this.databaseClient.get(), id),
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

  private validatePrivateMetadata(metadata: Challenge["private_metadata"]) {
    Value.Assert(ChallengePrivateMetadataBase, metadata);
  }

  async getRendered(id: number): Promise<PublicChallenge> {
    const c = await this.get(id, true);
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
