import type { Readable } from "node:stream";
import { PassThrough } from "node:stream";
import { createHash } from "node:crypto";
import { lookup } from "mime-types";

import { FileConfig } from "@noctf/api/config";
import type { ServiceCradle } from "../../index.ts";
import type { FileMetadata } from "@noctf/api/datatypes";
import { FileDAO } from "../../dao/file.ts";

type Props = Pick<ServiceCradle, "configService" | "databaseClient">;

export interface FileProvider {
  name: string;
  upload(rs: Readable): Promise<string>;
  delete(ref: string): Promise<void>;
  getURL(ref: string): Promise<string>;
  setMetadata(meta: Omit<FileMetadata, "url">): Promise<void>;
  download(
    ref: string,
    start?: number,
    end?: number,
  ): Promise<[Readable, Omit<FileMetadata, "url">]>;
}

export class FileService {
  private readonly configService;
  private readonly fileDAO;
  private readonly providers: Map<string, FileProvider> = new Map();

  constructor({ configService, databaseClient }: Props) {
    this.configService = configService;
    this.fileDAO = new FileDAO(databaseClient.get());
    void this.init();
  }

  async init() {
    await this.configService.register(FileConfig, {
      upload: "local",
    });
  }

  register(provider: FileProvider) {
    const name = provider.name;
    if (this.providers.has(name)) {
      throw new Error(`Provider ${name} is already registered`);
    }
    this.providers.set(name, provider);
  }

  getProvider(name: string) {
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Provider ${name} does not exist`);
    return provider;
  }

  async getMetadata(id: number): Promise<FileMetadata> {
    const metadata = await this.fileDAO.get(id);
    const provider = this.providers.get(metadata.provider);
    if (!provider)
      throw new Error(`Provider ${metadata.provider} does not exist`);
    return {
      ...metadata,
      hash: `sha256:${metadata.hash.toString("hex")}`,
      url: await provider.getURL(metadata.ref),
    };
  }

  async upload(filename: string, readStream: Readable): Promise<FileMetadata> {
    const {
      value: { upload },
    } = await this.configService.get<FileConfig>(FileConfig.$id!);
    const provider = this.providers.get(upload);
    if (!provider) throw new Error(`Provider ${upload} does not exist`);
    const sHash = new PassThrough();
    const sSize = new PassThrough();
    const sUpload = new PassThrough();
    readStream.pipe(sHash);
    readStream.pipe(sSize);
    readStream.pipe(sUpload);

    const [hash, size, ref] = await Promise.all([
      this.hash(sHash),
      this.size(sSize),
      provider.upload(sUpload),
    ]);

    const metadata = await this.fileDAO.create({
      hash,
      ref,
      size,
      filename,
      mime: lookup(filename) || "application/octet-stream",
      provider: upload,
    });
    const storeMetadata = {
      ...metadata,
      hash: `sha256:${metadata.hash.toString("hex")}`,
    };
    await provider.setMetadata(storeMetadata);

    return {
      ...storeMetadata,
      url: await provider.getURL(ref),
    };
  }

  async delete(id: number): Promise<void> {
    const { provider: name, ref } = await this.getMetadata(id);
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Provider ${name} does not exist`);
    await provider.delete(ref);
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
