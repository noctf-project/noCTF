import type { Readable } from "node:stream";
import { PassThrough } from "node:stream";
import { BinaryLike, createHash, createHmac } from "node:crypto";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { lookup } from "mime-types";
import { createReadStream, createWriteStream, mkdirSync } from "node:fs";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { FileConfig } from "@noctf/api/config";
import type { ServiceCradle } from "../index.ts";
import type { FileMetadata } from "@noctf/api/datatypes";
import { nanoid } from "nanoid";
import { BadRequestError, ForbiddenError, NotFoundError } from "../errors.ts";
import { ConfigService } from "./config.ts";

type Props = Pick<ServiceCradle, "cacheService" | "configService">;

export interface FileProvider {
  name: string;
  upload(ref: string, rs: Readable): Promise<void>;
  delete(ref: string): Promise<void>;
  getMetadata(ref: string): Promise<FileMetadata>;
  setMetadata(ref: string, meta: Omit<FileMetadata, "url">): Promise<void>;
}

const CACHE_METADATA_NAMESPACE = "core:file:metadata";

export class FileService {
  private readonly configService;
  private readonly cacheService;
  private readonly providers: Map<string, FileProvider> = new Map();

  constructor({ configService, cacheService }: Props) {
    this.configService = configService;
    this.cacheService = cacheService;
    void this.init();
  }

  async init() {
    await this.configService.register(FileConfig, {
      upload: "local",
    });
  }

  register(provider: FileProvider) {
    const name = provider.name;
    if (name.indexOf(":") !== -1)
      throw new Error("Provider name cannot have a colon");
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

  async getMetadata(id: string): Promise<FileMetadata> {
    const { provider, ref } = this.getRef(id);
    return this.cacheService.load(
      CACHE_METADATA_NAMESPACE,
      id,
      () => provider.getMetadata(ref),
      { expireSeconds: 600 }, // ideally this should never change files are immutable
    );
  }

  async upload(filename: string, readStream: Readable): Promise<FileMetadata> {
    const {
      value: { upload },
    } = await this.configService.get<FileConfig>(FileConfig.$id!);
    const provider = this.providers.get(upload);
    if (!provider) throw new Error(`Provider ${upload} does not exist`);
    const id = nanoid();
    const sHash = new PassThrough();
    const sSize = new PassThrough();
    const sUpload = new PassThrough();
    readStream.pipe(sHash);
    readStream.pipe(sSize);
    readStream.pipe(sUpload);

    const [hash, size] = await Promise.all([
      this.hash(sHash),
      this.size(sSize),
      provider.upload(id, sUpload),
    ]);
    const metadata: Omit<FileMetadata, "url"> = {
      hash,
      ref: `${upload}:${id}`,
      size,
      filename,
      mime: lookup(filename) || "application/octet-stream",
    };
    await provider.setMetadata(id, metadata);

    return { ...metadata, url: "" };
  }

  async delete(id: string): Promise<void> {
    const { provider, ref } = this.getRef(id);
    await provider.delete(ref);
    await this.cacheService.del(CACHE_METADATA_NAMESPACE, ref);
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

  private getRef(id: string) {
    const colon = id.indexOf(":");
    if (colon === -1) throw new Error("Invalid file ref");
    const name = id.slice(0, colon);
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Provider ${name} does not exist`);
    return {
      provider,
      ref: id.slice(colon + 1),
    };
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
      const { iat, sig } = this.signURL(ref);
      return {
        ...JSON.parse(
          await readFile(
            join(this.root, LocalFileProvider.METADATA_PATH, ref),
            "utf-8",
          ),
        ),
        url: `files/${encodeURIComponent(ref)}?iat=${iat}&sig=${sig.digest("base64url")}`,
      };
    } catch (e) {
      if (e.code === "ENOENT") {
        throw new NotFoundError("File not found");
      }
      throw e;
    }
  }

  private signURL(id: string, iat?: number) {
    if (!(typeof iat === "number")) {
      iat = Math.floor(Date.now() / 1000);
      iat =
        LocalFileProvider.SIGNED_URL_WINDOW *
        Math.floor(iat / LocalFileProvider.SIGNED_URL_WINDOW);
    }
    const payload = `v1!${id}!${iat}`;
    const sig = createHmac("sha256", this.secret).update(payload);
    return {
      id,
      iat,
      sig,
    };
  }

  async download(
    ref: string,
    start?: number,
    end?: number,
    signature?: { iat: number; sig: string },
  ): Promise<[Readable, FileMetadata]> {
    if (signature && signature.iat) {
      const { sig } = this.signURL(ref, signature.iat);
      try {
        if (!Buffer.from(signature.sig, "base64url").equals(sig.digest())) {
          throw new ForbiddenError("Invalid signature");
        }
      } catch (e) {
        if (!(e instanceof ForbiddenError))
          throw new ForbiddenError("Invalid signature");
        throw e;
      }
      const now = Math.floor(Date.now() / 1000);
      // add a random skewing factor
      if (signature.iat - LocalFileProvider.CLOCK_SKEW_WINDOW > now) {
        throw new ForbiddenError("Invalid signature timestamp");
      }
      if (
        signature.iat +
          LocalFileProvider.SIGNED_URL_WINDOW * 2 +
          LocalFileProvider.CLOCK_SKEW_WINDOW <
        now
      ) {
        throw new ForbiddenError("Signature expired");
      }
    }
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
