import { FileProvider } from "./index.ts";
import { createReadStream, createWriteStream, mkdirSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { type BinaryLike, createHmac } from "node:crypto";
import { join } from "node:path";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../errors.ts";
import { Readable } from "node:stream";
import { nanoid } from "nanoid";
import { FileMetadata } from "@noctf/api/datatypes";

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