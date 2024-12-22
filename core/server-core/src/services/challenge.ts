import {
  AdminCreateChallengeRequest,
  AdminUpdateChallengeRequest,
} from "@noctf/api/requests";
import { ChallengeDAO } from "../dao/challenge.ts";
import type { ServiceCradle } from "../index.ts";
import { AuditLogActor } from "../types/audit_log.ts";
import { Challenge } from "@noctf/api/datatypes";

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
  ) {
    const summaries = await this.dao.list(this.databaseClient.get(), query);
    if (removePrivateTags) {
      return summaries.map((c) => {
        c.tags = this.removePrivateTags(c.tags);
        return c;
      });
    }
    return summaries;
  }

  async get(idOrSlug: string | number) {
    return this.dao.get(this.databaseClient.get(), idOrSlug);
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

  async render(c: Challenge) {
    const rendered = {
      ...c,
      tags: this.removePrivateTags(c.tags),
    };
    delete rendered["private_metadata"];
    return rendered;
  }
}
