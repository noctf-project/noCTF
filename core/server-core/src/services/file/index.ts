import type { Readable } from "node:stream";
import { PassThrough } from "node:stream";
import { lookup } from "mime-types";

import { FileConfig } from "@noctf/api/config";
import type { ServiceCradle } from "../../index.ts";
import type { FileMetadata } from "@noctf/api/datatypes";
import { FileDAO } from "../../dao/file.ts";
import { FileProvider, FileProviderInstance } from "./types.ts";
import { Value } from "@sinclair/typebox/value";
import { ExternalFileProviderInstance } from "./external.ts";
import { NotFoundError } from "../../errors.ts";

type Props = Pick<ServiceCradle, "configService" | "databaseClient">;

export class FileService {
  private readonly configService;
  private readonly fileDAO;
  private readonly providers: Map<string, FileProvider<FileProviderInstance>> =
    new Map();

  private instances: Map<string, FileProviderInstance> = new Map();
  private configVersion: number;

  constructor({ configService, databaseClient }: Props) {
    this.configService = configService;
    this.fileDAO = new FileDAO(databaseClient.get());
    void this.init();
  }

  async init() {
    // We only want to load this once, and not allow it to be instantiated
    await this.configService.register(
      FileConfig,
      {
        upload: "local",
        instances: {
          local: {},
        },
      },
      (cfg) => {
        if (!cfg.instances[cfg.upload])
          throw new Error("upload provider is not in instances");
        const keys = Object.keys(cfg.instances);
        for (const name of keys) {
          const provider = this.getProviderFromInstance(name);
          const schema = provider.getSchema();
          if (schema) {
            const errors = [...Value.Errors(schema, cfg.instances[name])];
            if (errors.length)
              throw new Error(
                `JSONSchema Validation Error: ${JSON.stringify(errors)}`,
              );
          }
        }
      },
    );
  }

  register(provider: FileProvider<FileProviderInstance>) {
    const name = provider.name;
    if (this.providers.has(name)) {
      throw new Error(`Provider ${name} is already registered`);
    }
    this.providers.set(name, provider);
  }

  async getInstance(name: string) {
    const config = await this.configService.get(FileConfig);
    if (this.configVersion !== config.version) {
      this.instances = new Map([
        ["external", new ExternalFileProviderInstance()],
      ]);
      this.configVersion = this.configVersion;
    }
    let instance = this.instances.get(name);
    if (instance) return instance;
    console.log(this.instances);
    if (!config.value.instances[name])
      throw new NotFoundError(
        `Could not find provider instance ${name} in config`,
      );
    const provider = this.getProviderFromInstance(name);
    instance = await provider.getInstance(config.value.instances[name]);
    this.instances.set(name, instance);
    return instance;
  }

  async getMetadata(id: number): Promise<FileMetadata> {
    const metadata = await this.fileDAO.get(id);
    const instance = await this.getInstance(metadata.provider);
    return {
      ...metadata,
      url: await instance.getURL(metadata.ref),
    };
  }

  async upload(
    filename: string,
    readStream: Readable,
    provider?: string,
  ): Promise<FileMetadata> {
    const {
      value: { upload },
    } = await this.configService.get(FileConfig);
    const pv = provider ?? upload;
    const instance = await this.getInstance(pv);
    const mime = lookup(filename) || "application/octet-stream";

    const { hash, ref, size } = await instance.upload(readStream, {
      filename,
      mime,
    });

    const metadata = await this.fileDAO.create({
      hash,
      ref,
      size,
      filename,
      mime,
      provider: pv,
    });

    return {
      ...metadata,
      url: await instance.getURL(ref),
    };
  }

  async delete(id: number): Promise<void> {
    const { provider: name, ref } = await this.getMetadata(id);
    const instance = await this.getInstance(name);
    await instance.delete(ref);
    await this.fileDAO.delete(id);
  }

  private getProviderFromInstance(instance: string) {
    const colon = instance.indexOf(":");
    const pType = colon === -1 ? instance : instance.substring(0, colon);
    const provider = this.providers.get(pType);
    if (!provider) throw new Error(`Provider ${pType} not registered`);
    return provider;
  }
}
