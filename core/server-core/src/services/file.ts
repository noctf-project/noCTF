import { Readable, PassThrough } from "node:stream";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { lookup } from "mime-types";
import { createReadStream, createWriteStream, mkdirSync } from "node:fs";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { FileConfig } from "@noctf/api/config";
import { ServiceCradle } from "../index.ts";
import { FileMetadata } from "@noctf/api/datatypes";
import { nanoid } from "nanoid";
import { BadRequestError, NotFoundError } from "../errors.ts";

type Props = Pick<ServiceCradle, "configService">;

export interface FileProvider {
  name: string;
  upload(ref: string, rs: Readable): Promise<void>;
  download(
    ref: string,
    start?: number,
    end?: number,
  ): Promise<string | [Readable, FileMetadata]>;
  delete(ref: string): Promise<void>;
  getMetadata(ref: string): Promise<FileMetadata>;
  setMetadata(ref: string, meta: FileMetadata): Promise<void>;
}

export class FileService {
  private readonly configService;
  private readonly providers: Map<string, FileProvider> = new Map();

  constructor({ configService }: Props) {
    this.configService = configService;
    void this.init();
  }

  async init() {
    await this.configService.register(FileConfig, {
      upload: "local",
      download: "local",
    });
  }

  register(provider: FileProvider) {
    const name = provider.name;
    if (this.providers.has(name)) {
      throw new Error(`Provider ${name} is already registered`);
    }
    this.providers.set(name, provider);
  }

  async getMetadata(ref: string): Promise<FileMetadata> {
    const {
      value: { upload },
    } = await this.configService.get<FileConfig>(FileConfig.$id!);
    const provider = this.providers.get(upload);
    if (!provider) throw new Error(`Provider ${upload} does not exist`);
    return provider.getMetadata(ref);
  }

  async upload(filename: string, readStream: Readable): Promise<FileMetadata> {
    const {
      value: { upload },
    } = await this.configService.get<FileConfig>(FileConfig.$id!);
    const provider = this.providers.get(upload);
    if (!provider) throw new Error(`Provider ${upload} does not exist`);
    const ref = nanoid();
    const sHash = new PassThrough();
    const sSize = new PassThrough();
    const sUpload = new PassThrough();
    readStream.pipe(sHash);
    readStream.pipe(sSize);
    readStream.pipe(sUpload);

    const [hash, size] = await Promise.all([
      this.hash(sHash),
      this.size(sSize),
      provider.upload(ref, sUpload),
    ]);
    const metadata: FileMetadata = {
      hash,
      ref,
      size,
      filename,
      mime: lookup(filename) || "application/octet-stream",
    };
    await provider.setMetadata(ref, metadata);

    return metadata;
  }

  async delete(ref: string): Promise<void> {
    const {
      value: { upload },
    } = await this.configService.get<FileConfig>(FileConfig.$id!);
    const provider = this.providers.get(upload);
    if (!provider) throw new Error(`Provider ${upload} does not exist`);
    return provider.delete(ref);
  }

  async download(
    ref: string,
    start?: number,
    end?: number,
  ): Promise<string | [Readable, FileMetadata]> {
    const {
      value: { download },
    } = await this.configService.get<FileConfig>(FileConfig.$id!);
    const provider = this.providers.get(download);
    if (!provider) throw new Error(`Provider ${download} does not exist`);
    return provider.download(ref, start, end);
  }

  private hash(rs: Readable): Promise<string> {
    const hasher = createHash("sha256");
    return new Promise((resolve, reject) => {
      rs.on("error", reject);
      rs.on("data", (c) => hasher.update(c));
      rs.on("end", () => resolve(hasher.digest("hex")));
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

export class LocalFileProvider implements FileProvider {
  private static METADATA_PATH = "meta";
  private static OBJECT_PATH = "object";

  private readonly root;
  public readonly name = "local";

  constructor(root: string) {
    this.root = root;
    mkdirSync(join(root, LocalFileProvider.OBJECT_PATH), { recursive: true });
    mkdirSync(join(root, LocalFileProvider.METADATA_PATH), { recursive: true });
  }

  async delete(ref: string): Promise<void> {
    try {
      await unlink(join(this.root, LocalFileProvider.METADATA_PATH, ref));
      await unlink(join(this.root, LocalFileProvider.OBJECT_PATH, ref));
    } catch (e) {
      if (e.code === "ENOENT") {
        throw new NotFoundError("File not found");
      }
      throw e;
    }
    return;
  }

  async upload(ref: string, rs: Readable): Promise<void> {
    return pipeline(
      rs,
      createWriteStream(join(this.root, LocalFileProvider.OBJECT_PATH, ref)),
    );
  }

  async setMetadata(ref: string, meta: FileMetadata): Promise<void> {
    await writeFile(
      join(this.root, LocalFileProvider.METADATA_PATH, ref),
      JSON.stringify(meta),
    );
  }

  async getMetadata(ref: string): Promise<FileMetadata> {
    try {
      return JSON.parse(
        await readFile(
          join(this.root, LocalFileProvider.METADATA_PATH, ref),
          "utf-8",
        ),
      );
    } catch (e) {
      if (e.code === "ENOENT") {
        throw new NotFoundError("File not found");
      }
      throw e;
    }
  }

  async download(
    ref: string,
    start?: number,
    end?: number,
  ): Promise<string | [Readable, FileMetadata]> {
    // Just to check if file exists
    const metadata = await this.getMetadata(ref);
    if (!start) {
      start = 0;
    }
    if (!end) {
      end = metadata.size - 1 >= 0 ? metadata.size - 1 : 0;
    }
    if (end >= metadata.size) {
      throw new BadRequestError("Range end is larger than filesize");
    }
    return [
      createReadStream(join(this.root, LocalFileProvider.OBJECT_PATH, ref), {
        start,
        end,
      }),
      metadata,
    ];
  }
}
