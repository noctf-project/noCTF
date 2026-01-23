import { describe, it, expect } from "vitest";
import { ExternalFileProviderInstance } from "./external.ts";
import { Readable } from "stream";
import { BadRequestError } from "../../errors.ts";

describe("ExternalFileProviderInstance", () => {
  const provider = new ExternalFileProviderInstance();

  describe("upload", () => {
    it("should upload and return the correct metadata", async () => {
      const meta = {
        url: "https://example.com/file.txt",
        hash: "1234567890",
        size: 123,
      };
      const rs = Readable.from(Buffer.from(JSON.stringify(meta)));
      const result = await provider.upload(rs, {
        filename: "file.txt",
        mime: "text/plain",
      });
      expect(result.ref).toBe(meta.url);
      expect(result.hash).toBe(meta.hash);
      expect(result.size).toBe(meta.size);
    });

    it("should throw an error if the metadata is too large", async () => {
      const largeData = "a".repeat(3073);
      const rs = Readable.from(Buffer.from(largeData));
      await expect(
        provider.upload(rs, {
          filename: "file.txt",
          mime: "text/plain",
        }),
      ).rejects.toThrow(
        new BadRequestError(
          "Metadata exceeded maximum allowed number of bytes",
        ),
      );
    });

    it("should throw an error if the metadata is invalid", async () => {
      const invalidMeta = {
        url: "invalid-url",
        hash: "1234567890",
        size: 123,
      };
      const rs = Readable.from(Buffer.from(JSON.stringify(invalidMeta)));
      await expect(
        provider.upload(rs, {
          filename: "file.txt",
          mime: "text/plain",
        }),
      ).rejects.toThrow(
        new BadRequestError(
          "InvalidMetadataError",
          "Metadata failed to pass validation",
        ),
      );
    });
  });

  describe("getURL", () => {
    it("should return the provided ref", async () => {
      const ref = "https://example.com/file.txt";
      const result = await provider.getURL(ref);
      expect(result).toBe(ref);
    });
  });

  describe("delete", () => {
    it("should resolve without errors", async () => {
      await expect(provider.delete("some-ref")).resolves;
    });
  });

  describe("download", () => {
    it("should throw a 'Method not implemented' error", async () => {
      await expect(provider.download("some-ref")).rejects.toThrow(
        "Method not implemented.",
      );
    });
  });
});
