import { FileMetadata } from "@noctf/api/datatypes";
import { Readable } from "stream";
import type { FileProviderInstance, ProviderFileMetadata } from "./types.ts";
import { BadRequestError } from "../../errors.ts";
import { Type } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";

// The practical limit of a URL is around 2048 bytes
const MAX_BYTES = 3072;

const fileSchema = Type.Object(
  {
    url: Type.String({
      pattern: "^(https?|ftp):\\/\\/[^\\s/$.?#].[^\\s]*$",
      description: "Must be a valid URL starting with http, https, or ftp",
      maxLength: 2048,
    }),
    hash: Type.String({ maxLength: 255 }),
    size: Type.Number(),
  },
  { additionalProperties: false },
);
const compiled = TypeCompiler.Compile(fileSchema);

/**
 * The external file provider is for files that are not managed by noCTF itself,
 * but are instead stored on a separate site. A user would upload a JSON blob
 * which will be parsed into components in order to save to the DB.
*/
export class ExternalFileProviderInstance implements FileProviderInstance {
  async delete(_ref: string): Promise<void> {}

  async getURL(ref: string): Promise<string> {
    return ref;
  }

  async download(_ref: string): Promise<[Readable, Omit<FileMetadata, "url">]> {
    throw new Error("Method not implemented.");
  }

  async upload(
    rs: Readable,
    pm: Omit<ProviderFileMetadata, "size">,
  ): ReturnType<FileProviderInstance["upload"]> {
    let size = 0;
    const buf = Buffer.alloc(MAX_BYTES);
    await new Promise((resolve, reject) => {
      rs.on("error", reject);
      rs.on("data", (c: Buffer) => {
        const available = MAX_BYTES - size;
        console.log(available, c.length);
        if (c.length > available) {
          reject(
            new BadRequestError(
              "Metadata exceeded maximum allowed number of bytes",
            ),
          );
          rs.destroy();
        }
        c.copy(buf, size);
        size += c.length;
      });
      rs.on("end", resolve);
    });
    const meta: { url: string; hash: string; size: number } = JSON.parse(
      buf.toString("utf-8", 0, size),
    );

    if (!compiled.Check(meta)) {
      console.log([...compiled.Errors(meta)]);
      throw new BadRequestError(
        "InvalidMetadataError",
        "Metadata failed to pass validation",
      );
    }

    return { ref: meta.url, hash: meta.hash, size: meta.size };
  }
}
