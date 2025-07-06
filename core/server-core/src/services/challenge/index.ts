import type {
  AdminCreateChallengeRequest,
  AdminUpdateChallengeRequest,
} from "@noctf/api/requests";
import { ChallengeDAO } from "../../dao/challenge.ts";
import type { ServiceCradle } from "../../index.ts";
import type { AuditLogActor } from "../../types/audit_log.ts";
import type { ChallengePublicMetadataBase } from "@noctf/api/datatypes";
import { ChallengeUpdateEvent, SubmissionUpdateEvent } from "@noctf/api/events";
import {
  Slug,
  type Challenge,
  type ChallengeMetadata,
  type PublicChallenge,
} from "@noctf/api/datatypes";
import type { ValidateFunction } from "ajv";
import { Ajv } from "ajv";
import {
  BadRequestError,
  ConflictError,
  NotImplementedError,
  ValidationError,
} from "../../errors.ts";
import type { SomeJSONSchema } from "ajv/dist/types/json-schema.js";
import { SubmissionDAO } from "../../dao/submission.ts";
import { ChallengePlugin } from "./types.ts";
import { CoreChallengePlugin } from "./core_plugin.ts";
import { LocalCache } from "../../util/local_cache.ts";
import type { SerializableMap } from "@noctf/api/types";

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

const SLUG_REGEX = new RegExp(Slug.format!);
export class ChallengeService {
  private readonly logger;
  private readonly auditLogService;
  private readonly eventBusService;
  private readonly challengeDAO;
  private readonly submissionDAO;
  private readonly ajv = new Ajv();
  private readonly listCache = new LocalCache<string, ChallengeMetadata[]>({
    max: 256,
    ttl: 5000,
  });
  private readonly getCache = new LocalCache<number | string, Challenge>({
    max: 256,
    ttl: 5000,
  });
  private readonly renderedCache = new LocalCache<number, PublicChallenge>({
    max: 256,
    ttl: 5000,
  });
  private privateMetadataSchema: SomeJSONSchema;
  private privateMetadataSchemaValidator: ValidateFunction;

  private readonly plugins: Map<string, ChallengePlugin> = new Map();

  constructor({
    logger,
    auditLogService,
    databaseClient,
    eventBusService,
    fileService,
    scoreService,
  }: Props) {
    this.logger = logger;
    this.auditLogService = auditLogService;
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
    await this.eventBusService.publish(ChallengeUpdateEvent, {
      id: challenge.id,
      slug: challenge.slug,
      version: challenge.version,
      updated_at: challenge.updated_at,
      hidden: challenge.hidden,
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
    const { version, slug, updated_at, hidden } =
      await this.challengeDAO.update(id, v);
    await this.auditLogService.log({
      operation: "challenge.update",
      actor,
      entities: [`challenge:${id}`],
      data: `Updated to version ${version}`,
    });
    await this.eventBusService.publish(ChallengeUpdateEvent, {
      id,
      slug,
      version,
      updated_at,
      hidden,
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
    return this.listCache.load(`list:${options?.cacheKey}`, fn);
  }

  async get(idOrSlug: number | string, cached = false): Promise<Challenge> {
    if (typeof idOrSlug === "string") {
      if (parseInt(idOrSlug)) {
        idOrSlug = parseInt(idOrSlug);
      } else if (!idOrSlug.match(SLUG_REGEX)) {
        throw new BadRequestError(
          "ValidationError",
          "Slug does not match format",
        );
      }
    }
    if (cached) {
      return this.getCache.load(idOrSlug, () =>
        this.challengeDAO.get(idOrSlug),
      );
    }
    return this.challengeDAO.get(idOrSlug);
  }

  async delete(id: number) {
    return this.challengeDAO.delete(id);
  }

  async solve(
    ch: ChallengeMetadata | number,
    teamId: number,
    userId: number,
    data: string,
    metadata?: SerializableMap,
  ) {
    let challenge;
    if (typeof ch === "number") {
      challenge = await this.get(ch, true);
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
      const solved = state.status === "correct";
      const { id, updated_at } = await this.submissionDAO.create({
        team_id: teamId,
        user_id: userId,
        challenge_id: challenge.id,
        source: challenge.private_metadata.solve.source,
        data,
        status: state.status,
        comments: state.comment,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: metadata as any,
      });
      if (solved) {
        await this.eventBusService.publish(SubmissionUpdateEvent, {
          id,
          challenge_id: challenge.id,
          status: state.status,
          team_id: teamId,
          user_id: userId,
          updated_at,
          hidden: false,
        });
      }
      return state.status;
      // TODO: queueing, currently it is just marked as queued. probably emit
      // TODO: to event bus
    }
    throw new NotImplementedError("The challenge is not solvable");
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
    return await this.renderedCache.load(id, async () => {
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
        updated_at: c.updated_at,
      };
    });
  }
}
