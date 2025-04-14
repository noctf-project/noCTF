import type { Readable } from "node:stream";
import { PassThrough } from "node:stream";
import { createHash } from "node:crypto";
import { lookup } from "mime-types";

import { FileConfig } from "@noctf/api/config";
import type { ServiceCradle } from "../../index.ts";
import type { FileMetadata } from "@noctf/api/datatypes";
import { FileDAO } from "../../dao/file.ts";
import { ProviderFileMetadata } from "./types.ts";
import { TSchema } from "@sinclair/typebox";

type Props = Pick<ServiceCradle, "configService" | "databaseClient">;

export interface FileProvider<T extends FileProviderInstance> {
  name: string;
  getInstance(config: any): T | Promise<T>;
  getSchema(): TSchema | null;
}

export interface FileProviderInstance {
  upload(rs: Readable, pm: Omit<ProviderFileMetadata, "size">): Promise<string>;
  delete(ref: string): Promise<void>;
  getURL(ref: string): Promise<string>;
  download(
    ref: string,
    start?: number,
    end?: number,
  ): Promise<[Readable, ProviderFileMetadata]>;
}

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
    await this.configService.register(FileConfig, {
      upload: "local",
      instances: {
        local: {},
      },
    });
  }

  register(provider: FileProvider<FileProviderInstance>) {
    const name = provider.name;
    if (this.providers.has(name)) {
      throw new Error(`Provider ${name} is already registered`);
    }
    this.providers.set(name, provider);
  }

  async getInstance(name: string) {
    const config = await this.configService.get<FileConfig>(FileConfig.$id!);
    if (this.configVersion !== config.version) {
      this.instances = new Map();
      this.configVersion = this.configVersion;
    }
    let instance = this.instances.get(name);
    if (instance) return instance;
    if (!config.value.instances[name])
      throw new Error(`Could not find provider instance ${name} in config`);
    const colon = name.indexOf(":");
    const pType = colon === -1 ? name : name.substring(0, colon);
    const provider = this.providers.get(pType);
    if (!provider) throw new Error(`Provider ${pType} not registered`);
    instance = await provider.getInstance(config.value.instances[name]);
    this.instances.set(name, instance);
    return instance;
  }

  async getMetadata(id: number): Promise<FileMetadata> {
    const metadata = await this.fileDAO.get(id);
    const instance = await this.getInstance(metadata.provider);
    return {
      ...metadata,
      hash: `sha256:${metadata.hash.toString("hex")}`,
      url: await instance.getURL(metadata.ref),
    };
  }

  async upload(filename: string, readStream: Readable): Promise<FileMetadata> {
    const {
      value: { upload },
    } = await this.configService.get<FileConfig>(FileConfig.$id!);
    const instance = await this.getInstance(upload);
    const sHash = new PassThrough();
    const sSize = new PassThrough();
    const sUpload = new PassThrough();
    readStream.pipe(sHash);
    readStream.pipe(sSize);
    readStream.pipe(sUpload);
    const mime = lookup(filename) || "application/octet-stream";

    const [hash, size, ref] = await Promise.all([
      this.hash(sHash),
      this.size(sSize),
      instance.upload(sUpload, { filename, mime }),
    ]);

    const metadata = await this.fileDAO.create({
      hash,
      ref,
      size,
      filename,
      mime,
      provider: upload,
    });
    const storeMetadata = {
      ...metadata,
      hash: `sha256:${metadata.hash.toString("hex")}`,
    };

    return {
      ...storeMetadata,
      url: await instance.getURL(ref),
    };
  }

  async delete(id: number): Promise<void> {
    const { provider: name, ref } = await this.getMetadata(id);
    const instance = await this.getInstance(name);
    await instance.delete(ref);
    await this.fileDAO.delete(id);
  }

  private hash(rs: Readable): Promise<Buffer> {
    const hasher = createHash("sha256");
    return new Promise((resolve, reject) => {
      rs.on("error", reject);
      rs.on("data", (c) => hasher.update(c));
      rs.on("end", () => resolve(hasher.digest()));
    });
  }

  private size(rs: Readable): Promise<number> {
    let size = 0;
    return new Promise((resolve, reject) => {
      rs.on("error", reject);
      rs.on("data", (c) => (size += c.length));
      rs.on("end", () => resolve(size));
    });
  }
}
