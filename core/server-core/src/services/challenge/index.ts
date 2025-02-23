import type {
  AdminCreateChallengeRequest,
  AdminUpdateChallengeRequest,
} from "@noctf/api/requests";
import { ChallengeDAO } from "../../dao/challenge.ts";
import type { ServiceCradle } from "../../index.ts";
import type { AuditLogActor } from "../../types/audit_log.ts";
import type { ChallengePublicMetadataBase } from "@noctf/api/datatypes";
import {
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
} from "../../errors.ts";
import type { SomeJSONSchema } from "ajv/dist/types/json-schema.js";
import { SubmissionDAO } from "../../dao/submission.ts";
import { CACHE_SCORE_NAMESPACE } from "../scoreboard.ts";
import { ChallengePlugin } from "./types.ts";
import { CoreChallengePlugin } from "./core_plugin.ts";

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

const CACHE_NAMESPACE = "core:svc:challenge";

export class ChallengeService {
  private readonly logger;
  private readonly auditLogService;
  private readonly cacheService;
  private readonly eventBusService;
  private readonly challengeDAO;
  private readonly submissionDAO;
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
    this.eventBusService = eventBusService;

    this.challengeDAO = new ChallengeDAO(databaseClient.get());
    this.submissionDAO = new SubmissionDAO(databaseClient.get());

    // TODO: plugin loader
    this.register(
      new CoreChallengePlugin({ logger, scoreService, fileService }),
    );
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
    const challenge = await this.challengeDAO.create(v);
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
    const { version } = await this.challengeDAO.update(id, v);
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
    query: Parameters<ChallengeDAO["list"]>[0],
    options?: {
      removePrivateTags?: boolean;
      cacheKey?: string;
    },
  ): Promise<ChallengeMetadata[]> {
    const fn = async () => {
      const summaries = await this.challengeDAO.list(query);
      if (options?.removePrivateTags) {
        return summaries.map((c) => {
          c.tags = this.removePrivateTags(c.tags);
          return c;
        });
      }
      return summaries;
    };
    if (!options?.cacheKey) {
      return fn();
    }
    return this.cacheService.load(
      CACHE_NAMESPACE,
      `list:${options?.cacheKey}`,
      fn,
    );
  }

  async get(id: number, cached = false): Promise<Challenge> {
    if (cached) {
      return this.cacheService.load(CACHE_NAMESPACE, `c:${id}`, () =>
        this.challengeDAO.get(id),
      );
    }
    return this.challengeDAO.get(id);
  }

  async delete(id: number) {
    return this.challengeDAO.delete(id);
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
      challenge.id,
      teamId,
    );
    if (submission) {
      throw new ConflictError("A current (queued or solved) submission exists");
    }
    for (const [_plugin, impl] of this.plugins) {
      this.logger.debug({ name: impl.name() }, "Attempting presolve plugin");
      const state = await impl.preSolve(challenge, teamId, data);
      if (!state) {
        continue;
      }
      this.logger.debug(
        { name: impl.name() },
        "Presolve plugin returned a valid result",
      );
      const solved = state.status === ChallengeSolveStatus.Correct;
      this.submissionDAO.create({
        team_id: teamId,
        user_id: userId,
        challenge_id: challenge.id,
        source: challenge.private_metadata.solve.source,
        data,
        queued: state.status === ChallengeSolveStatus.Queued,
        solved,
        comments: state.comment,
      });
      if (solved) {
        // TODO: emit solve to event bus
        this.cacheService.del(CACHE_SCORE_NAMESPACE, "scoreboard");
        this.cacheService.del(CACHE_SCORE_NAMESPACE, `c:${challenge.id}`);
      }
      return state.status;
      // TODO: queueing, currently it is just marked as queued. probably emit
      // TODO: to event bus
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
      this.challengeDAO.getMetadata(id),
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
