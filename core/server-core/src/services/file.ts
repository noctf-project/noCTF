import type { Readable } from "node:stream";
import { PassThrough } from "node:stream";
import { BinaryLike, createHash, createHmac } from "node:crypto";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { lookup } from "mime-types";
import { createReadStream, createWriteStream, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { unlink } from "node:fs/promises";
import { FileConfig } from "@noctf/api/config";
import type { ServiceCradle } from "../index.ts";
import type { FileMetadata } from "@noctf/api/datatypes";
import { nanoid } from "nanoid";
import { BadRequestError, ForbiddenError, NotFoundError } from "../errors.ts";
import { FileDAO } from "../dao/file.ts";

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

export class LocalFileProvider implements FileProvider {
  private static METADATA_PATH = "meta";
  private static OBJECT_PATH = "object";

  private static SIGNED_URL_WINDOW = 600; // File is active for a max of twice as long as this
  private static CLOCK_SKEW_WINDOW = 30;

  public readonly name = "local";
  private readonly secret;

  constructor(
    private readonly root: string,
    secret: BinaryLike,
  ) {
    this.secret = createHmac("sha256", secret)
      .update("file.provider.local")
      .digest();
    mkdirSync(join(root, LocalFileProvider.OBJECT_PATH), { recursive: true });
    mkdirSync(join(root, LocalFileProvider.METADATA_PATH), { recursive: true });
  }

  async delete(ref: string): Promise<void> {
    try {
      await Promise.all([
        unlink(join(this.root, LocalFileProvider.METADATA_PATH, ref)),
        unlink(join(this.root, LocalFileProvider.OBJECT_PATH, ref)),
      ]);
    } catch (e) {
      if (e.code === "ENOENT") {
        throw new NotFoundError("File not found");
      }
      throw e;
    }
    return;
  }

  async upload(rs: Readable): Promise<string> {
    const ref = nanoid();
    await pipeline(
      rs,
      createWriteStream(join(this.root, LocalFileProvider.OBJECT_PATH, ref)),
    );
    return ref;
  }

  async getURL(ref: string) {
    const { iat, sig } = this.signURL(ref);
    return `files/local/${ref}?iat=${iat}&sig=${sig.toString("base64url")}`;
  }

  private signURL(ref: string, iat?: number) {
    if (!(typeof iat === "number")) {
      iat = Math.floor(Date.now() / 1000);
      iat =
        LocalFileProvider.SIGNED_URL_WINDOW *
        Math.floor(iat / LocalFileProvider.SIGNED_URL_WINDOW);
    }
    const payload = `v1!${ref}!${iat}`;
    const sig = createHmac("sha256", this.secret).update(payload).digest();
    return {
      iat,
      sig,
    };
  }

  async setMetadata(meta: FileMetadata): Promise<void> {
    await writeFile(
      join(this.root, LocalFileProvider.METADATA_PATH, meta.ref),
      JSON.stringify(meta),
    );
  }

  checkSignature(ref: string, iat: number, signature: string) {
    const { sig: expected } = this.signURL(ref, iat);
    try {
      if (!Buffer.from(signature, "base64url").equals(expected)) {
        throw new ForbiddenError("Invalid signature");
      }
    } catch (e) {
      if (!(e instanceof ForbiddenError))
        throw new ForbiddenError("Invalid signature");
      throw e;
    }
    const now = Math.floor(Date.now() / 1000);
    // add a random skewing factor
    if (iat - LocalFileProvider.CLOCK_SKEW_WINDOW > now) {
      throw new ForbiddenError("Invalid signature timestamp");
    }
    if (
      iat +
        LocalFileProvider.SIGNED_URL_WINDOW * 2 +
        LocalFileProvider.CLOCK_SKEW_WINDOW <
      now
    ) {
      throw new ForbiddenError("Signature expired");
    }
  }

  private async getMetadata(ref: string): Promise<Omit<FileMetadata, "url">> {
    try {
      return {
        ...JSON.parse(
          await readFile(
            join(this.root, LocalFileProvider.METADATA_PATH, ref),
            "utf-8",
          ),
        ),
      };
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
  ): Promise<[Readable, Omit<FileMetadata, "url">]> {
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
