import { FastifyBaseLogger } from "fastify";
import { DatabaseService } from "./database.ts";
import { ValidationError } from "@noctf/server-api/errors";
import { Serializable } from "@noctf/server-api/types";

type Validator = (kv: Serializable) => Promise<string | null>;

const nullValidator = async (): Promise<null> => {
  return null;
};

export class ConfigService {
  private validators: Map<string, Validator> = new Map();

  constructor(
    private logger: FastifyBaseLogger,
    private databaseService: DatabaseService,
  ) {}

  /**
   * Get config from config storage
   * @param namespace namespace
   * @returns configuration map
   */
  async get<T extends Serializable>(namespace: string): Promise<T> {
    const config = await this.databaseService
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
   * Update config and run validator
   * @param namespace namespace
   * @param data config data, an object of primitive values + object + array
   */
  async update(namespace: string, data: Serializable) {
    if (!this.validators.has(namespace)) {
      throw new ValidationError("Config namespace does not exist");
    }
    const result = await this.validators.get(namespace)(data);

    if (result) {
      throw new ValidationError(
        `Config validation failed with error: ${result}`,
      );
    }

    this.databaseService
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
   * @param validator config validator, this is run when config is updated
   */
  async register(
    namespace: string,
    defaultCfg: Serializable,
    validator?: Validator,
  ) {
    if (this.validators.has(namespace)) {
      throw new Error(
        `Config with namespace ${namespace} has already been registered`,
      );
    }
    this.validators.set(namespace, validator || nullValidator);
    this.logger.info("Registering config namespace %s", namespace);
    const result = await this.databaseService
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
