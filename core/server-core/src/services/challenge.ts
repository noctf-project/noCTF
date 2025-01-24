import type {
  AdminCreateChallengeRequest,
  AdminUpdateChallengeRequest,
} from "@noctf/api/requests";
import { ChallengeDAO } from "../dao/challenge.ts";
import type { ServiceCradle } from "../index.ts";
import type { AuditLogActor } from "../types/audit_log.ts";
import type { ChallengePublicMetadataBase } from "@noctf/api/datatypes";
import {
  ChallengePrivateMetadataBase,
  ChallengeSolveInputType,
  ChallengeSolveStatus,
  type Challenge,
  type ChallengeMetadata,
  type PublicChallenge,
} from "@noctf/api/datatypes";
import type { ValidateFunction } from "ajv";
import { Ajv } from "ajv";
import {
  ConflictError,
  NotImplementedError,
  ValidationError,
} from "../errors.ts";
import type { TSchema } from "@sinclair/typebox";
import type { SomeJSONSchema } from "ajv/dist/types/json-schema.js";
import pLimit from "p-limit";
import { SubmissionDAO } from "../dao/submission.ts";

type Props = Pick<
  ServiceCradle,
  | "logger"
  | "auditLogService"
  | "databaseClient"
  | "cacheService"
  | "eventBusService"
  | "fileService"
  | "scoreService"
>;

type CorePluginProps = Pick<ServiceCradle, "fileService" | "scoreService">;

export type SolveData = {
  status: ChallengeSolveStatus;
  comment?: string;
};

export interface ChallengePlugin {
  name: () => string;
  privateSchema: () => TSchema;
  render: (m: Challenge["private_metadata"]) => Promise<object>;
  validate: (m: Challenge["private_metadata"]) => Promise<void>;
  preSolve: (
    m: Challenge["private_metadata"],
    teamId: number,
    data: string,
  ) => Promise<SolveData | null>;
}

const FILE_METADATA_LIMIT = 16;
const FILE_METADATA_LIMITER = pLimit(FILE_METADATA_LIMIT);

const CACHE_NAMESPACE = "core:svc:challenge";

export class CoreChallengePlugin implements ChallengePlugin {
  private readonly scoreService;
  private readonly fileService;

  constructor({ scoreService, fileService }: CorePluginProps) {
    this.scoreService = scoreService;
    this.fileService = fileService;
  }

  name() {
    return "core";
  }

  privateSchema() {
    return ChallengePrivateMetadataBase;
  }

  preSolve = async () => {
    // TODO: return correct result
    return {
      status: ChallengeSolveStatus.Correct,
    };
  };

  render = async (
    m: ChallengePrivateMetadataBase,
  ): Promise<ChallengePublicMetadataBase> => {
    return {
      solve: {
        input_type:
          m.solve.source === "flag"
            ? ChallengeSolveInputType.Text
            : m.solve.source === "manual"
              ? m.solve.manual!.input_type
              : ChallengeSolveInputType.None,
      },
      files: await Promise.all(
        Object.keys(m.files).map((name) =>
          FILE_METADATA_LIMITER(() =>
            this.fileService.getMetadata(m.files[name].ref),
          ).then(({ hash, size }) => ({ name, hash, size })),
        ),
      ),
    };
  };

  validate = async (m: ChallengePrivateMetadataBase) => {
    try {
      await this.scoreService.evaluate(m.score.strategy, m.score.params, 0);
    } catch (e) {
      throw new ValidationError(
        `Failed to evaluate scoring algorithm ${m.score.strategy}: ` +
          e.message,
      );
    }
    if (m.solve.source === "flag" && !m.solve.flag) {
      throw new ValidationError(
        "Solve configuration for source 'flag' is missing",
      );
    } else if (m.solve.source === "manual" && !m.solve.manual) {
      throw new ValidationError(
        "Solve configuration for source 'manual' is missing",
      );
    }

    const keys = Object.keys(m.files);
    const filePromises = await Promise.allSettled(
      keys.map((k) =>
        FILE_METADATA_LIMITER(() =>
          this.fileService.getMetadata(m.files[k].ref),
        ),
      ),
    );
    const filesFailed = filePromises
      .map(({ status }, i) => status === "rejected" && keys[i])
      .filter((x) => x);
    if (filesFailed.length) {
      throw new ValidationError(
        `Failed to validate that files refs exist for: ${filesFailed.join(", ")}`,
      );
    }
  };
}

export class ChallengeService {
  private readonly logger;
  private readonly auditLogService;
  private readonly cacheService;
  private readonly databaseClient;
  private readonly eventBusService;
  private readonly challengeDAO = new ChallengeDAO();
  private readonly submissionDAO = new SubmissionDAO();
  private readonly ajv = new Ajv();
  private privateMetadataSchema: SomeJSONSchema;
  private privateMetadataSchemaValidator: ValidateFunction;

  private readonly plugins: Map<string, ChallengePlugin> = new Map();

  constructor({
    logger,
    auditLogService,
    cacheService,
    databaseClient,
    eventBusService,
    fileService,
    scoreService,
  }: Props) {
    this.logger = logger;
    this.auditLogService = auditLogService;
    this.cacheService = cacheService;
    this.databaseClient = databaseClient;
    this.eventBusService = eventBusService;
    this.register(new CoreChallengePlugin({ scoreService, fileService }));
  }

  /**
   * Registers a plugin
   */
  register(plugin: ChallengePlugin) {
    const name = plugin.name();
    if (this.plugins.has(name)) {
      throw new Error(`Plugin ${name} has already been registered`);
    }
    this.plugins.set(name, plugin);
    this.buildPrivateMetadataSchema();
  }

  async create(v: AdminCreateChallengeRequest, actor?: AuditLogActor) {
    await this.validatePrivateMetadata(v.private_metadata);
    const challenge = await this.challengeDAO.create(
      this.databaseClient.get(),
      v,
    );
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
    const { version } = await this.challengeDAO.update(
      this.databaseClient.get(),
      id,
      v,
    );
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
    const summaries = await this.challengeDAO.list(
      this.databaseClient.get(),
      query,
    );
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
        this.challengeDAO.get(this.databaseClient.get(), id),
      );
    }
    return this.challengeDAO.get(this.databaseClient.get(), id);
  }

  async delete(id: number) {
    return this.challengeDAO.delete(this.databaseClient.get(), id);
  }

  async solve(
    ch: ChallengeMetadata | number,
    teamId: number,
    userId: number,
    data: string,
  ) {
    let challenge;
    if (typeof ch === "number") {
      challenge = await this.getMetadata(ch);
    } else {
      challenge = ch;
    }
    const submission = await this.submissionDAO.getCurrentMetadata(
      this.databaseClient.get(),
      challenge.id,
      teamId,
    );
    if (submission) {
      throw new ConflictError("A current (queued or solved) submission exists");
    }
    for (const [_plugin, { preSolve, name }] of this.plugins) {
      this.logger.debug({ name: name() }, "Attempting presolve plugin");
      const state = await preSolve(challenge.private_metadata, teamId, data);
      if (!state) {
        continue;
      }
      this.logger.debug({ name: name() }, "Matched presolve plugin");
      this.submissionDAO.create(this.databaseClient.get(), {
        team_id: teamId,
        user_id: userId,
        challenge_id: challenge.id,
        source: challenge.private_metadata.solve.source,
        data,
        queued: state.status === ChallengeSolveStatus.Queued,
        solved: state.status === ChallengeSolveStatus.Correct,
        comments: state.comment,
      });
      return state.status;
      // TODO: queueing, currently it is just marked as queued
    }
    throw new NotImplementedError("The challenge is not solvable");
  }

  /**
   * Gets the metadata of a challenge. Always returns a cached response
   * @param id ID Or Slug
   * @returns Challenge
   */
  async getMetadata(id: number) {
    return this.cacheService.load(CACHE_NAMESPACE, `m:${id}`, () =>
      this.challengeDAO.getMetadata(this.databaseClient.get(), id),
    );
  }

  private removePrivateTags(tags: Record<string, string>) {
    return Object.keys(tags)
      .filter((t) => !t.startsWith("noctf:"))
      .reduce(
        (p, v) => {
          p[v] = tags[v];
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
    for (const [_plugin, { validate }] of this.plugins) {
      await validate(metadata);
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
        .map(([_, { privateSchema: schema }]) => schema())
        .toArray(),
      required: [],
    };
    this.privateMetadataSchemaValidator = this.ajv.compile(
      this.privateMetadataSchema,
    );
  }

  async getRendered(id: number): Promise<PublicChallenge> {
    const c = await this.get(id, true);
    let metadata: unknown = {};
    for (const [_plugin, { render }] of this.plugins) {
      metadata = { ...(await render(c.private_metadata)) };
    }
    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description,
      metadata: metadata as unknown as ChallengePublicMetadataBase,
      hidden: c.hidden,
      visible_at: c.visible_at,
    };
  }
}
