import { Static, TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { ServiceCradle } from "../index.ts";
import { ValidationError } from "../errors.ts";
import { SerializableMap } from "../types.ts";

type Validator = (kv: SerializableMap) => Promise<string | null>;

const nullValidator = async (): Promise<null> => {
  return null;
};

type Props = Pick<ServiceCradle, "logger" | "cacheClient" | "databaseClient">;
const EXPIRY_MS = 3000;

export class ConfigService {
  // A simple map-based cache is good enough, we want low latency and don't really need
  // to evict stuff, all the config keys are static and there shouldn't be too many.
  private readonly cache: Map<string, [Promise<SerializableMap>, number]> =
    new Map();
  private readonly logger: Props["logger"];
  private readonly databaseClient: Props["databaseClient"];
  private readonly validators: Map<string, [TSchema, Validator]> = new Map();

  constructor({ logger, databaseClient }: Props) {
    this.logger = logger;
    this.databaseClient = databaseClient;
  }

  /**
   * Get config from config storage
   * @param namespace namespace
   * @returns configuration map
   */
  async get<T extends SerializableMap>(
    namespace: string,
    cache = true,
  ): Promise<T> {
    if (!this.validators.has(namespace)) {
      throw new ValidationError("Config namespace does not exist");
    }
    if (!cache) {
      return this._queryDb(namespace);
    }
    const now = Date.now();
    if (this.cache.has(namespace)) {
      const [promise, exp] = this.cache.get(namespace);
      if (exp > now) {
        try {
          return this.cache.get(namespace)[0] as Promise<T>;
        } catch (e) {
          this.logger.debug("failed to retrieve config value %s", {
            namespace,
          });
        }
      }
    }
    const newPromise = this._queryDb<T>(namespace);
    this.cache.set(namespace, [newPromise, now + EXPIRY_MS]);
    const result = await newPromise;
    // Update expiry time since we just fetched the object
    this.cache.set(namespace, [newPromise, Date.now() + EXPIRY_MS]);
    return result;
  }

  private async _queryDb<T extends SerializableMap>(
    namespace: string,
  ): Promise<T> {
    const config = await this.databaseClient
      .selectFrom("core.config")
      .select("data")
      .where("namespace", "=", namespace)
      .executeTakeFirst();
    if (config) {
      return JSON.parse(config.data);
    }
    return {} as T;
  }

  /**
   * Get schema for config.
   * @param namespace namespace
   * @returns config map
   */
  getSchema(namespace: string) {
    if (!this.validators.has(namespace)) {
      throw new ValidationError("Config namespace does not exist");
    }
    return this.validators.get(namespace)[0];
  }

  /**
   * Update config and run validator
   * @param namespace namespace
   * @param data config data, an object of primitive values + object + array
   */
  async update(namespace: string, data: SerializableMap, noValidate?: boolean) {
    if (!this.validators.has(namespace)) {
      throw new ValidationError("Config namespace does not exist");
    }
    const [schema, validator] = this.validators.get(namespace);
    Value.Check(schema, data);
    if (!noValidate) {
      const result = await validator(data);
      if (result) {
        throw new ValidationError(
          `Config validation failed with error: ${result}`,
        );
      }
    }

    this.databaseClient
      .updateTable("core.config")
      .set({
        data: JSON.stringify(data),
        updated_at: new Date(),
      })
      .where("namespace", "=", namespace)
      .execute();
  }

  /**
   * Register default config values. This hook is run once on plugin startup.
   * @param namespace namespace
   * @param schema JSON Schema definition
   * @param defaultCfg default config
   * @param validator config validator, this is run when config is updated
   */
  async register(
    namespace: string,
    schema: TSchema,
    defaultCfg: Static<typeof schema>,
    validator?: Validator,
  ) {
    if (this.validators.has(namespace)) {
      throw new Error(
        `Config with namespace ${namespace} has already been registered`,
      );
    }
    this.validators.set(namespace, [schema, validator || nullValidator]);
    this.logger.info("Registering config namespace %s", namespace);
    const result = await this.databaseClient
      .insertInto("core.config")
      .values({
        namespace,
        data: JSON.stringify(defaultCfg),
      })
      .onConflict((c) => c.doNothing())
      .executeTakeFirst();

    if (result.numInsertedOrUpdatedRows) {
      this.logger.info("Populated default values into namespace %s", namespace);
    }
  }
}
