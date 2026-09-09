import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalFileProviderInstance } from "./local.ts";
import { Readable } from "node:stream";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

describe(LocalFileProviderInstance, () => {
  let tempDir: string;
  let provider: LocalFileProviderInstance;
  const secret = "test-secret-key-1234";

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "local-file-provider-test-"));
    provider = new LocalFileProviderInstance(tempDir, secret);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("upload", () => {
    it("should upload file, compute correct hash/size, and save complete content to disk", async () => {
      const content = Buffer.from(
        "Hello world, this is a test file for streaming verification!",
      );
      const expectedHash = `sha256:${createHash("sha256").update(content).digest("hex")}`;
      const rs = Readable.from(content);

      const result = await provider.upload(rs, {
        filename: "test.txt",
        mime: "text/plain",
      });

      expect(result.size).toBe(content.length);
      expect(result.hash).toBe(expectedHash);
      expect(result.ref).toBeDefined();

      const savedContent = await readFile(join(tempDir, "object", result.ref));
      expect(savedContent).toEqual(content);

      const [downloadStream, meta] = await provider.download(result.ref);
      expect(meta.size).toBe(content.length);
      expect(meta.filename).toBe("test.txt");
      expect(meta.mime).toBe("text/plain");

      const downloadedChunks: Buffer[] = [];
      for await (const chunk of downloadStream) {
        downloadedChunks.push(Buffer.from(chunk));
      }
      expect(Buffer.concat(downloadedChunks)).toEqual(content);
    });

    it("should handle multi-chunk asynchronous stream uploads without dropping data", async () => {
      const chunks = [
        Buffer.from("chunk-1: "),
        Buffer.from("chunk-2: "),
        Buffer.from("chunk-3: final data"),
      ];
      const fullBuffer = Buffer.concat(chunks);
      const expectedHash = `sha256:${createHash("sha256").update(fullBuffer).digest("hex")}`;

      const rs = new Readable({
        read() {
          const next = chunks.shift();
          if (next) {
            this.push(next);
          } else {
            this.push(null);
          }
        },
      });

      const result = await provider.upload(rs, {
        filename: "multichunk.bin",
        mime: "application/octet-stream",
      });

      expect(result.size).toBe(fullBuffer.length);
      expect(result.hash).toBe(expectedHash);

      const savedContent = await readFile(join(tempDir, "object", result.ref));
      expect(savedContent).toEqual(fullBuffer);
    });
  });
});
