import { describe, it, expect } from "vitest";
import { Compress, Decompress } from "./message_compression.ts";

describe("message_compression", () => {
  const sampleText = "The quick brown fox jumps over the lazy dog. ".repeat(
    100,
  );
  const samplePayload = new TextEncoder().encode(sampleText);

  it("compresses and decompresses with method 0 (none) to get the same payload", async () => {
    const compressed = await Compress(samplePayload, 0);
    expect(compressed[0]).toBe(0);

    const decompressed = await Decompress(compressed);
    expect(Buffer.from(decompressed)).toEqual(Buffer.from(samplePayload));
  });

  it("compresses and decompresses with method 1 (brotli) to get the same payload", async () => {
    const compressed = await Compress(samplePayload, 1);
    expect(compressed[0]).toBe(1);

    const decompressed = await Decompress(compressed);
    expect(Buffer.from(decompressed)).toEqual(Buffer.from(samplePayload));
  });

  it("compresses and decompresses with method 2 (zstd) to get the same payload", async () => {
    const compressed = await Compress(samplePayload, 2);
    expect(compressed[0]).toBe(2);

    const decompressed = await Decompress(compressed);
    expect(Buffer.from(decompressed)).toEqual(Buffer.from(samplePayload));
  });

  it("falls back to method 0 when payload is below compression threshold", async () => {
    const smallPayload = new TextEncoder().encode("small payload");
    const compressed = await Compress(smallPayload, 2);
    expect(compressed[0]).toBe(0);

    const decompressed = await Decompress(compressed);
    expect(Buffer.from(decompressed)).toEqual(Buffer.from(smallPayload));
  });
});
