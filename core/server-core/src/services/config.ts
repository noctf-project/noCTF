import { FastifyBaseLogger } from "fastify";
import { Static, TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { DatabaseClient } from "../clients/database.ts";
import { ValidationError } from "../errors.ts";
import { SerializableMap } from "../types.ts";

type Validator = (kv: SerializableMap) => Promise<string | null>;

const nullValidator = async (): Promise<null> => {
  return null;
};

type Props = {
  logger: FastifyBaseLogger;
  databaseClient: DatabaseClient;
};

export class ConfigService {
  private logger: Props["logger"];
  private databaseClient: Props["databaseClient"];

  private validators: Map<string, [TSchema, Validator]> = new Map();

  constructor({ logger, databaseClient }: Props) {
    this.logger = logger;
    this.databaseClient = databaseClient;
  }

  /**
   * Get config from config storage
   * @param namespace namespace
   * @returns configuration map
   */
  async get(namespace: string): Promise<SerializableMap> {
    if (!this.validators.has(namespace)) {
      throw new ValidationError("Config namespace does not exist");
    }
    const config = await this.databaseClient
      .selectFrom("core.config")
      .select("data")
      .where("namespace", "=", namespace)
      .executeTakeFirst();
    if (config) {
      return JSON.parse(config.data);
    }
    return {};
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
