import type { Static, TSchema } from "@sinclair/typebox";
import type { ServiceCradle } from "../index.ts";
import { BadRequestError, ValidationError } from "../errors.ts";
import type { SerializableMap } from "../types/primitives.ts";
import type { AuditLogActor } from "../types/audit_log.ts";
import type { ValidateFunction } from "ajv";
import { Ajv } from "ajv";
import type { JsonObject } from "@noctf/schema";
import { ConfigDAO } from "../dao/config.ts";

type Validator<T> = (kv: T) => Promise<string | null> | string | null;

const nullValidator = async (): Promise<null> => {
  return null;
};

type Props = Pick<
  ServiceCradle,
  "logger" | "cacheService" | "databaseClient" | "auditLogService"
>;
export type ConfigValue<T extends SerializableMap> = {
  version: number;
  value: T;
};

const EXPIRY_MS = 2000;

export class ConfigService {
  // A simple map-based cache is good enough, we want low latency and don't really need
  // to evict stuff, all the config keys are static and there shouldn't be too many.
  private readonly ajv = new Ajv();
  private readonly dao = new ConfigDAO();
  private readonly logger;
  private readonly databaseClient;
  private readonly auditLogService;
  private readonly validators: Map<
    string,
    [ValidateFunction, Validator<unknown>]
  > = new Map();

  private cache: Map<string, [Promise<ConfigValue<SerializableMap>>, number]> =
    new Map();

  constructor({ logger, databaseClient, auditLogService }: Props) {
    this.logger = logger;
    this.databaseClient = databaseClient;
    this.auditLogService = auditLogService;
  }

  /**
   * Clears the cache
   */
  clearCache() {
    this.cache = new Map();
  }

  /**
   * Get config from config storage
   * @param namespace namespace
   * @returns configuration map
   */
  async get<T extends SerializableMap>(
    namespace: string,
    noCache?: boolean,
  ): Promise<ConfigValue<T>> {
    if (!this.validators.has(namespace)) {
      throw new ValidationError("Config namespace does not exist");
    }
    if (noCache) {
      return this.dao.get(this.databaseClient.get(), namespace);
    }
    const now = performance.now();
    const v = this.cache.get(namespace);
    if (v) {
      const [promise, exp] = v;
      if (exp > now) {
        try {
          return promise as Promise<ConfigValue<T>>;
        } catch (error) {
          this.logger.debug(
            { namespace },
            "failed to retrieve config value",
            error,
          );
        }
      }
    }
    const newPromise = this.dao.get<T>(this.databaseClient.get(), namespace);
    this.cache.set(namespace, [newPromise, now + EXPIRY_MS]);
    const result = await newPromise;
    // Update expiry time since we just fetched the object
    this.cache.set(namespace, [newPromise, performance.now() + EXPIRY_MS]);
    return result;
  }

  /**
   * Get schema for config.
   * @param namespace namespace
   * @returns array of configuration namespaces and schemas
   */
  getSchemas() {
    return [...this.validators].map(([namespace, [schema]]) => ({
      namespace,
      schema,
    }));
  }

  /**
   * Update config and run validator
   * @param namespace namespace
   * @param value config data
   * @param version current version ID
   * @param noValidate skip the custom validation function
   */
  async update<T extends SerializableMap>({
    namespace,
    value,
    version,
    noValidate,
    actor,
  }: {
    namespace: string;
    value: T;
    version?: number;
    noValidate?: boolean;
    actor?: AuditLogActor;
  }): Promise<ConfigValue<T>> {
    const v = this.validators.get(namespace);
    if (!v) {
      throw new ValidationError("Config namespace does not exist");
    }
    const [av, validator] = v;
    if (!av(value)) {
      throw new ValidationError(
        "JSONSchema: " +
          (av.errors || [])
            .map((e) => `${e.instancePath || "/"} ${e.message}`)
            .join(", "),
      );
    }
    if (!noValidate) {
      const result = await validator(value);
      if (result) {
        throw new ValidationError(
          `Config validation failed with error: ${result}`,
        );
      }
    }

    const updated = await this.dao.update(
      this.databaseClient.get(),
      namespace,
      value,
      version,
    );
    await this.auditLogService.log({
      actor,
      operation: "config.update",
      entities: [namespace],
      data: JSON.stringify(value),
    });
    const promise = Promise.resolve({
      version: updated,
      value,
    });
    this.cache.set(namespace, [promise, performance.now() + EXPIRY_MS]);
    return promise;
  }

  /**
   * Register default config values. This hook is run once on plugin startup.
   * @param namespace Namespace
   * @param schema JSON Schema definition
   * @param defaultCfg default config
   * @param validator config validator, this is run when config is updated
   */
  async register<T extends TSchema>(
    schema: T,
    defaultCfg: Static<T>,
    validator?: Validator<T>,
  ) {
    const namespace = schema.$id;
    if (!namespace) {
      throw new Error("schema has no $id field");
    }
    this.validators.set(namespace, [
      this.ajv.compile(schema),
      validator || nullValidator,
    ]);
    this.logger.info("Registered config namespace %s", namespace);
    const result = await this.databaseClient
      .get()
      .insertInto("config")
      .values({
        namespace,
        value: defaultCfg as JsonObject,
      })
      .onConflict((c) => c.doNothing())
      .executeTakeFirst();

    if (result.numInsertedOrUpdatedRows) {
      this.logger.info("Populated default values into namespace %s", namespace);
    }
  }
}
