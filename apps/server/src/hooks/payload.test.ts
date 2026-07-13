import { describe, expect, test } from "vitest";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { FastifyRequest, FastifyReply } from "fastify";
import { BadRequestError } from "@noctf/server-core/errors";
import {
  PayloadDigestPreParsingHook,
  PayloadDigestPreValidationHook,
} from "./payload.ts";

function createMockRequest(
  headers: Record<string, string | string[]>,
): FastifyRequest {
  return {
    headers,
    digests: undefined,
    _parsedDigestHeader: undefined,
  } as unknown as FastifyRequest;
}

const mockReply = {} as FastifyReply;

describe(PayloadDigestPreParsingHook, () => {
  test("should pass through when content-digest header is missing", async () => {
    const req = createMockRequest({});
    const data = "hello world";
    const payload = Readable.from([data]);

    const result = await PayloadDigestPreParsingHook(req, mockReply, payload);

    expect(result).toBe(payload);
    expect(req.digests).toBeUndefined();
    expect(req._parsedDigestHeader).toEqual({});
  });

  test("should throw BadRequestError if content-digest is an array", async () => {
    const req = createMockRequest({
      "content-digest": ["sha-256=abc", "sha-512=def"],
    });
    const payload = Readable.from(["data"]);

    await expect(
      PayloadDigestPreParsingHook(req, mockReply, payload),
    ).rejects.toThrow(BadRequestError);
  });

  test("should compute sha-256 digest correctly", async () => {
    const data = "test-payload-data";
    const hash = createHash("sha256").update(data).digest();
    const base64Hash = hash.toString("base64");

    const req = createMockRequest({
      "content-digest": `sha-256=${base64Hash}`,
    });
    const payload = Readable.from([data]);

    const resultStream = await PayloadDigestPreParsingHook(
      req,
      mockReply,
      payload,
    );

    // Consume the returned stream to trigger 'end'
    const chunks: Buffer[] = [];
    for await (const chunk of resultStream) {
      chunks.push(Buffer.from(chunk));
    }
    const consumedData = Buffer.concat(chunks).toString();

    expect(consumedData).toBe(data);
    expect(req._parsedDigestHeader?.["sha-256"]).toEqual(hash);
    expect(req.digests?.["sha-256"]).toEqual(hash);
  });

  test("should compute sha-512 digest correctly", async () => {
    const data = "another-payload-data";
    const hash = createHash("sha512").update(data).digest();
    const base64Hash = hash.toString("base64");

    const req = createMockRequest({
      "content-digest": `sha-512=${base64Hash}`,
    });
    const payload = Readable.from([data]);

    const resultStream = await PayloadDigestPreParsingHook(
      req,
      mockReply,
      payload,
    );

    // Consume the returned stream to trigger 'end'
    const chunks: Buffer[] = [];
    for await (const chunk of resultStream) {
      chunks.push(Buffer.from(chunk));
    }

    expect(Buffer.concat(chunks).toString()).toBe(data);
    expect(req._parsedDigestHeader?.["sha-512"]).toEqual(hash);
    expect(req.digests?.["sha-512"]).toEqual(hash);
  });

  test("should support multiple digests when no spaces are present in header", async () => {
    const data = "multi-hash-payload";
    const hash256 = createHash("sha256").update(data).digest();
    const hash512 = createHash("sha512").update(data).digest();

    const req = createMockRequest({
      "content-digest": `sha-256=${hash256.toString("base64")},sha-512=${hash512.toString("base64")}`,
    });
    const payload = Readable.from([data]);

    const resultStream = await PayloadDigestPreParsingHook(
      req,
      mockReply,
      payload,
    );

    // Consume stream
    for await (const _ of resultStream) {
      /* noop */
    }

    expect(req._parsedDigestHeader?.["sha-256"]).toEqual(hash256);
    expect(req._parsedDigestHeader?.["sha-512"]).toEqual(hash512);
    expect(req.digests?.["sha-256"]).toEqual(hash256);
    expect(req.digests?.["sha-512"]).toEqual(hash512);
  });

  test("should fail with BadRequestError when spaces are present in header (current codebase limitation)", async () => {
    const req = createMockRequest({
      "content-digest": "sha-256=abc, sha-512=def",
    });
    const payload = Readable.from(["data"]);

    await expect(
      PayloadDigestPreParsingHook(req, mockReply, payload),
    ).rejects.toThrow(BadRequestError);
  });

  test("should throw BadRequestError on invalid algorithms", async () => {
    const req = createMockRequest({
      "content-digest": "md5=abc",
    });
    const payload = Readable.from(["data"]);

    await expect(
      PayloadDigestPreParsingHook(req, mockReply, payload),
    ).rejects.toThrow(BadRequestError);
  });
});

describe(PayloadDigestPreValidationHook, () => {
  test("should throw Error if route is misconfigured (missing _parsedDigestHeader)", async () => {
    const req = createMockRequest({});

    await expect(PayloadDigestPreValidationHook(req)).rejects.toThrow(
      "Route is misconfigured",
    );
  });

  test("should succeed if computed and parsed digests match", async () => {
    const digestVal = Buffer.from("matching-digest");
    const req = {
      _parsedDigestHeader: { "sha-256": digestVal },
      digests: { "sha-256": digestVal },
    } as unknown as FastifyRequest;

    await expect(PayloadDigestPreValidationHook(req)).resolves.not.toThrow();
  });

  test("should throw BadRequestError if digests do not match", async () => {
    const parsedDigest = Buffer.from("digest-one");
    const computedDigest = Buffer.from("digest-two");
    const req = {
      _parsedDigestHeader: { "sha-256": parsedDigest },
      digests: { "sha-256": computedDigest },
    } as unknown as FastifyRequest;

    await expect(PayloadDigestPreValidationHook(req)).rejects.toThrow(
      BadRequestError,
    );
  });

  test("should throw BadRequestError if digests have different lengths", async () => {
    const parsedDigest = Buffer.from("short");
    const computedDigest = Buffer.from("longer-digest-value");
    const req = {
      _parsedDigestHeader: { "sha-256": parsedDigest },
      digests: { "sha-256": computedDigest },
    } as unknown as FastifyRequest;

    await expect(PayloadDigestPreValidationHook(req)).rejects.toThrow(
      BadRequestError,
    );
  });
});
