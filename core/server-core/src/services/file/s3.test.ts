import { describe, it, expect, vi } from "vitest";
import { S3FileProviderInstance } from "./s3.ts";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { Client } from "minio";

describe(S3FileProviderInstance, () => {
  it("should supply a complete readable stream to putObject even while summarizing", async () => {
    const instance = new S3FileProviderInstance(
      {
        endPoint: "s3.example.com",
        region: "us-east-1",
      },
      "test-bucket",
    );

    const content = Buffer.from("S3 stream multipart upload test data");
    const expectedHash = `sha256:${createHash("sha256").update(content).digest("hex")}`;

    let receivedUploadBytes = Buffer.alloc(0);

    // Mock client.putObject to consume the passed stream asynchronously, similar to MinIO
    const client = Reflect.get(instance, "client") as Client;
    vi.spyOn(client, "putObject").mockImplementation(
      async (_bucket, _path, stream) => {
        const chunks: Buffer[] = [];
        for await (const chunk of stream as AsyncIterable<Buffer | string>) {
          chunks.push(Buffer.from(chunk));
        }
        receivedUploadBytes = Buffer.concat(chunks);
        return { etag: "fake-etag", versionId: null };
      },
    );

    const rs = Readable.from(content);
    const result = await instance.upload(rs, {
      filename: "test.txt",
      mime: "text/plain",
    });

    expect(result.size).toBe(content.length);
    expect(result.hash).toBe(expectedHash);
    expect(result.ref).toBeDefined();
    // Verify that the stream passed to putObject was NOT drained/empty
    expect(receivedUploadBytes).toEqual(content);
  });
});
