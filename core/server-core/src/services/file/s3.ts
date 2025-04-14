import { FileMetadata } from "@noctf/api/datatypes";
import { Readable } from "stream";
import { FileProvider, FileProviderInstance } from "./index.ts";
import { nanoid } from "nanoid";
import { Client } from "minio";
import { ProviderFileMetadata } from "./types.ts";
import { Static, Type } from "@sinclair/typebox";

export const S3FileProviderConfig = Type.Object({
  endPoint: Type.String(),
  useSSL: Type.Optional(Type.Boolean()),
  port: Type.Optional(Type.Integer({ minimum: 1, maximum: 65535 })),
  region: Type.String({ pattern: "^[a-z0-9-]+$", maxLength: 63 }),
  accessKey: Type.String(), // TODO: support injecting through env var
  secretKey: Type.String(),
  bucket: Type.String({ pattern: "^[a-zA-Z0-9-_\\.]+$", maxLength: 63 }),
});
export type S3FileProviderConfig = Static<typeof S3FileProviderConfig>;

export class S3FileProvider implements FileProvider<S3FileProviderInstance> {
  name = "s3";

  getInstance({ bucket, ...config }: S3FileProviderConfig) {
    return new S3FileProviderInstance(config, bucket);
  }

  getSchema() {
    return S3FileProviderConfig;
  }
}

export class S3FileProviderInstance implements FileProviderInstance {
  private static SIGNED_URL_WINDOW = 600; // File is active for a max of twice as long as this

  private readonly client;

  constructor(
    config: Omit<S3FileProviderConfig, "bucket">,
    private readonly bucket: string,
  ) {
    this.client = new Client(config);
  }

  async upload(
    rs: Readable,
    pm: Omit<ProviderFileMetadata, "size">,
  ): Promise<string> {
    const ref = `noctf-files/${nanoid()}`;
    await this.client.putObject(this.bucket, ref, rs, undefined, {
      "content-disposition": `attachment; filename=${JSON.stringify(pm.filename)}`,
      "content-type": pm.mime,
    });
    return ref;
  }

  async delete(ref: string): Promise<void> {
    await this.client.removeObject(this.bucket, ref);
  }

  async getURL(ref: string): Promise<string> {
    // windowing to improve caching
    let iat = Math.floor(Date.now() / 1000);
    iat =
      S3FileProviderInstance.SIGNED_URL_WINDOW *
      Math.floor(iat / S3FileProviderInstance.SIGNED_URL_WINDOW);
    return await this.client.presignedGetObject(
      this.bucket,
      ref,
      S3FileProviderInstance.SIGNED_URL_WINDOW * 2,
      undefined,
      new Date(iat * 1000),
    );
  }

  async download(): Promise<[Readable, Omit<FileMetadata, "url">]> {
    throw new Error("Method not implemented.");
  }
}
