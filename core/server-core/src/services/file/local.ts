import {
  FileProvider,
  FileProviderInstance,
  ProviderFileMetadata,
} from "./types.ts";
import { createReadStream, createWriteStream, mkdirSync } from "node:fs";
import { readFile, stat, unlink, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { type BinaryLike, createHmac, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../errors.ts";
import { summarizeFile } from "./summarize.ts";
import { PassThrough, Readable } from "node:stream";
import { nanoid } from "nanoid";

export class LocalFileProvider
  implements FileProvider<LocalFileProviderInstance>
{
  name = "local";

  private readonly secret;

  constructor(
    private readonly root: string,
    secret: BinaryLike,
  ) {
    this.secret = createHmac("sha256", secret)
      .update("file.provider.local")
      .digest();
  }

  getSchema(): null {
    return null;
  }

  getInstance() {
    return new LocalFileProviderInstance(this.root, this.secret);
  }
}

export class LocalFileProviderInstance implements FileProviderInstance {
  private static METADATA_PATH = "meta";
  private static OBJECT_PATH = "object";

  private static SIGNED_URL_WINDOW = 600; // File is active for a max of twice as long as this
  private static CLOCK_SKEW_WINDOW = 30;

  constructor(
    private readonly root: string,
    private readonly secret: BinaryLike,
  ) {
    mkdirSync(join(root, LocalFileProviderInstance.OBJECT_PATH), {
      recursive: true,
    });
    mkdirSync(join(root, LocalFileProviderInstance.METADATA_PATH), {
      recursive: true,
    });
  }

  async delete(ref: string): Promise<void> {
    try {
      await Promise.all([
        unlink(join(this.root, LocalFileProviderInstance.METADATA_PATH, ref)),
        unlink(join(this.root, LocalFileProviderInstance.OBJECT_PATH, ref)),
      ]);
    } catch (e) {
      if (e.code === "ENOENT") {
        throw new NotFoundError("File not found");
      }
      throw e;
    }
    return;
  }

  async upload(
    rs: Readable,
    m: Omit<ProviderFileMetadata, "size">,
  ): ReturnType<FileProviderInstance["upload"]> {
    const dup = new PassThrough();
    rs.pipe(dup);
    const ref = nanoid();
    const fp = join(this.root, LocalFileProviderInstance.OBJECT_PATH, ref);
    const [summary, _] = await Promise.all([
      summarizeFile(dup),
      pipeline(rs, createWriteStream(fp)),
    ]);
    await this.setProviderMetadata(ref, { ...m, size: (await stat(fp)).size });
    return { ref, ...summary };
  }

  async getURL(ref: string) {
    const { iat, sig } = this.signURL(ref);
    return `files/local/${ref}?iat=${iat}&sig=${sig.toString("base64url")}`;
  }

  private signURL(ref: string, iat?: number) {
    if (!(typeof iat === "number")) {
      iat = Math.floor(Date.now() / 1000);
      iat =
        LocalFileProviderInstance.SIGNED_URL_WINDOW *
        Math.floor(iat / LocalFileProviderInstance.SIGNED_URL_WINDOW);
    }
    const payload = `v1!${ref}!${iat}`;
    const sig = createHmac("sha256", this.secret).update(payload).digest();
    return {
      iat,
      sig,
    };
  }

  private async setProviderMetadata(
    ref: string,
    meta: ProviderFileMetadata,
  ): Promise<void> {
    await writeFile(
      join(this.root, LocalFileProviderInstance.METADATA_PATH, ref),
      JSON.stringify(meta),
    );
  }

  checkSignature(ref: string, iat: number, signature: string) {
    const { sig: expected } = this.signURL(ref, iat);
    try {
      if (!timingSafeEqual(Buffer.from(signature, "base64url"), expected)) {
        throw new ForbiddenError("Invalid signature");
      }
    } catch (e) {
      if (!(e instanceof ForbiddenError))
        throw new ForbiddenError("Invalid signature");
      throw e;
    }
    const now = Math.floor(Date.now() / 1000);
    // add a random skewing factor
    if (iat - LocalFileProviderInstance.CLOCK_SKEW_WINDOW > now) {
      throw new ForbiddenError("Invalid signature timestamp");
    }
    if (
      iat +
        LocalFileProviderInstance.SIGNED_URL_WINDOW * 2 +
        LocalFileProviderInstance.CLOCK_SKEW_WINDOW <
      now
    ) {
      throw new ForbiddenError(
        "Signature expired, please refresh the page to get the new link",
      );
    }
  }

  private async getMetadata(ref: string): Promise<ProviderFileMetadata> {
    try {
      return {
        ...JSON.parse(
          await readFile(
            join(this.root, LocalFileProviderInstance.METADATA_PATH, ref),
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
  ): Promise<[Readable, ProviderFileMetadata]> {
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
      createReadStream(
        join(this.root, LocalFileProviderInstance.OBJECT_PATH, ref),
        {
          start,
          end,
        },
      ),
      metadata,
    ];
  }
}
