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
import type { ValidateFunction } from "ajv";
import { Ajv } from "ajv";
import { ValidationError } from "../errors.ts";
import type { TSchema } from "@sinclair/typebox";
import type { SomeJSONSchema } from "ajv/dist/types/json-schema.js";

type Props = Pick<
  ServiceCradle,
  | "auditLogService"
  | "databaseClient"
  | "cacheService"
  | "fileService"
  | "scoreService"
>;

type PluginInstance = {
  schema: TSchema;
  validator: (m: Challenge["private_metadata"]) => Promise<void>;
};

const CACHE_NAMESPACE = "core:svc:challenge";
export class ChallengeService {
  private readonly auditLogService;
  private readonly cacheService;
  private readonly databaseClient;
  private readonly fileService;
  private readonly scoreService;
  private readonly dao = new ChallengeDAO();
  private readonly ajv = new Ajv();
  private privateMetadataSchema: SomeJSONSchema;
  private privateMetadataSchemaValidator: ValidateFunction;

  private readonly plugins: Map<string, PluginInstance> = new Map([
    [
      "core",
      {
        schema: ChallengePrivateMetadataBase,
        validator: this.validateCore.bind(this),
      },
    ],
  ]);

  constructor({
    auditLogService,
    cacheService,
    databaseClient,
    fileService,
    scoreService,
  }: Props) {
    this.auditLogService = auditLogService;
    this.cacheService = cacheService;
    this.databaseClient = databaseClient;
    this.fileService = fileService;
    this.scoreService = scoreService;
    this.buildPrivateMetadataSchema();
  }

  async create(v: AdminCreateChallengeRequest, actor?: AuditLogActor) {
    await this.validatePrivateMetadata(v.private_metadata);
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
    if (v.private_metadata)
      await this.validatePrivateMetadata(v.private_metadata);
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

  getPrivateMetadataSchema() {
    return this.privateMetadataSchema;
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

  async delete(id: number) {
    return this.dao.delete(this.databaseClient.get(), id);
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

  private async validatePrivateMetadata(
    metadata: Challenge["private_metadata"],
  ) {
    const valid = this.privateMetadataSchemaValidator(metadata);
    if (!valid) {
      throw new ValidationError(
        "JSONSchema: " +
          (this.privateMetadataSchemaValidator.errors || [])
            .map((e) => `${e.instancePath || "/"} ${e.message}`)
            .join(", "),
      );
    }
    for (const [_plugin, { validator }] of this.plugins) {
      await validator(metadata);
    }
  }

  /**
   * Call this function whenever we install a new plugin
   */
  private buildPrivateMetadataSchema() {
    this.privateMetadataSchema = {
      type: "object",
      allOf: this.plugins
        .entries()
        .map(([_, { schema }]) => schema)
        .toArray(),
      required: [],
    };
    this.privateMetadataSchemaValidator = this.ajv.compile(
      this.privateMetadataSchema,
    );
  }

  private async validateCore(m: ChallengePrivateMetadataBase) {
    try {
      await this.scoreService.evaluate(m.score.strategy, m.score.params, 0);
    } catch (e) {
      throw new ValidationError(
        `Failed to evaluate scoring algorithm ${m.score.strategy}: ` +
          e.message,
      );
    }

    const keys = Object.keys(m.files);
    const filePromises = await Promise.allSettled(
      keys.map((k) => this.fileService.getMetadata(m.files[k].ref)),
    );
    const filesFailed = filePromises
      .map(({ status }, i) => status === "rejected" && keys[i])
      .filter((x) => x);
    if (filesFailed.length) {
      throw new ValidationError(
        `Failed to validate that files refs exist for: ${filesFailed.join(", ")}`,
      );
    }
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
