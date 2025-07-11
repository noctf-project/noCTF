import type { Static, TObject, TSchema } from "@sinclair/typebox";
import type { ServiceCradle } from "../index.ts";
import { ValidationError } from "../errors.ts";
import type { AuditLogActor } from "../types/audit_log.ts";
import type { ValidateFunction } from "ajv";
import { Ajv } from "ajv";
import { default as AddFormats } from "ajv-formats";
import { ConfigDAO } from "../dao/config.ts";
import type { SerializableMap } from "@noctf/api/types";
import { ConfigUpdateEvent } from "@noctf/api/events";

type Validator<T> = (kv: T) => Promise<void> | void;

const nullValidator = () => {};

type Props = Pick<
  ServiceCradle,
  | "logger"
  | "cacheService"
  | "databaseClient"
  | "auditLogService"
  | "eventBusService"
>;
export type ConfigValue<T extends SerializableMap> = {
  version: number;
  value: T;
};

const EXPIRY_MS = 10000;

export class ConfigService {
  // A simple map-based cache is good enough, we want low latency and don't really need
  // to evict stuff, all the config keys are static and there shouldn't be too many.
  private readonly ajv = new Ajv();
  private readonly dao;
  private readonly logger;
  private readonly auditLogService;
  private readonly eventBusService;
  private readonly validators: Map<
    string,
    [TSchema, ValidateFunction, Validator<unknown>]
  > = new Map();

  private cache: Map<string, [Promise<ConfigValue<SerializableMap>>, number]> =
    new Map();

  constructor({
    logger,
    databaseClient,
    auditLogService,
    eventBusService,
  }: Props) {
    // This is cursed but ajv types are currently broken
    // https://github.com/ajv-validator/ajv-formats/issues/85
    (AddFormats as unknown as (a: Ajv) => void)(this.ajv);
    this.logger = logger;
    this.auditLogService = auditLogService;
    this.eventBusService = eventBusService;
    this.dao = new ConfigDAO(databaseClient.get());
    void this.subscribeConfigUpdate();
  }

  /**
   * Clears the cache
   */
  clearCache() {
    this.cache = new Map();
  }

  /**
   * Listen for config update messages
   */
  private async subscribeConfigUpdate() {
    await this.eventBusService.subscribe<ConfigUpdateEvent>(
      new AbortController().signal,
      undefined,
      [ConfigUpdateEvent.$id!],
      {
        concurrency: 1,
        handler: async ({ data: { namespace, version } }) => {
          this.logger.debug(
            { namespace, version },
            "Invalidating config entry for namespace",
          );
          this.cache.delete(namespace);
        },
      },
    );
  }

  /**
   * Get config from config storage
   * @param namespace namespace
   * @returns configuration map
   */
  async get<S extends SerializableMap>(
    namespaceOrDef: string,
    noCache?: boolean,
  ): Promise<ConfigValue<S>>;
  async get<T extends TObject>(
    namespaceOrDef: T,
    noCache?: boolean,
  ): Promise<ConfigValue<Static<T> & SerializableMap>>;
  async get<
    T extends TObject = TObject,
    S extends SerializableMap = T extends TObject
      ? Static<T> & SerializableMap
      : SerializableMap,
  >(namespaceOrDef: string | T, noCache?: boolean): Promise<ConfigValue<S>> {
    let namespace: string;
    if (typeof namespaceOrDef === "string") {
      namespace = namespaceOrDef;
    } else {
      namespace = namespaceOrDef.$id!;
    }
    if (!this.validators.has(namespace)) {
      throw new ValidationError("Config namespace does not exist");
    }
    if (noCache) {
      return this.dao.get(namespace);
    }
    const now = performance.now();
    const v = this.cache.get(namespace);
    if (v) {
      const [promise, exp] = v;
      if (exp > now) {
        try {
          return promise as Promise<ConfigValue<S>>;
        } catch (error) {
          this.logger.debug(
            { namespace },
            "failed to retrieve config value",
            error,
          );
        }
      }
    }
    const newPromise = this.dao.get<T>(namespace);
    this.cache.set(namespace, [newPromise, now + EXPIRY_MS]);
    const result = await newPromise;
    // Update expiry time since we just fetched the object
    this.cache.set(namespace, [newPromise, performance.now() + EXPIRY_MS]);
    return result as unknown as ConfigValue<S>;
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
    const [_schema, av, validator] = v;
    if (!av(value)) {
      throw new ValidationError(
        "JSONSchema: " +
          (av.errors || [])
            .map((e) => `${e.instancePath || "/"} ${e.message}`)
            .join(", "),
      );
    }
    if (!noValidate) {
      try {
        await validator(value);
      } catch (e) {
        if (e instanceof ValidationError) throw e;
        throw new ValidationError(
          `Custom validation function failed with error: ${e.message}`,
        );
      }
    }

    const updated = await this.dao.update(namespace, value, version);
    this.cache.delete(namespace);
    await Promise.all([
      this.auditLogService.log({
        actor,
        operation: "config.update",
        entities: [`config:${namespace}`],
        data: `Updated to version ${updated.version}`,
      }),
      this.eventBusService.publish(ConfigUpdateEvent, {
        namespace,
        version: updated.version,
        updated_at: updated.updated_at,
      }),
    ]);
    return {
      version: updated.version,
      value,
    };
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
    validator?: Validator<Static<T>>,
  ) {
    const namespace = schema.$id;
    if (!namespace) {
      throw new Error("schema has no $id field");
    }
    this.validators.set(namespace, [
      schema,
      this.ajv.compile(schema),
      validator || nullValidator,
    ]);
    this.logger.info("Registered config namespace %s", namespace);

    if (await this.dao.register(namespace, defaultCfg as SerializableMap)) {
      this.logger.info("Populated default values into namespace %s", namespace);
    }
  }
}
