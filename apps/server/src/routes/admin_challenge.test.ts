import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { createSigner, createVerifier, httpbis } from "http-message-signatures";
import type { IncomingHttpHeaders } from "node:http";
import { FilterUndefinedHeaders } from "./admin_challenge.ts";

const KEY = "test-weight-update-hmac-key";
const METHOD = "PUT";
const REQUEST_URL = "https://weights.example.com/admin/challenges/42/weights";

const BASE_FIELDS = ["@method", "@path", "@authority"];
const WITH_DIGEST_FIELDS = [...BASE_FIELDS, "content-digest"];

function verify(
  headers: Record<string, string | string[]>,
  requiredFields: string[],
) {
  return httpbis.verifyMessage(
    {
      keyLookup: async () => ({
        verify: createVerifier(KEY, "hmac-sha256"),
      }),
      tolerance: 60,
      requiredFields,
    },
    {
      method: METHOD,
      url: new URL(REQUEST_URL),
      headers,
    },
  );
}

async function sign(
  fields: string[],
  extraHeaders: Record<string, string | string[]> = {},
) {
  const signed = await httpbis.signMessage(
    { key: createSigner(KEY, "hmac-sha256"), fields },
    { method: METHOD, url: REQUEST_URL, headers: extraHeaders },
  );
  return signed.headers;
}

function asIncomingHeaders(
  headers: Record<string, string | string[]>,
): IncomingHttpHeaders {
  return { ...headers, "x-fake-undefined": undefined };
}

describe(FilterUndefinedHeaders, () => {
  test("drops undefined-valued entries and preserves the rest", () => {
    const filtered = FilterUndefinedHeaders({
      host: "weights.example.com",
      "content-digest": ["sha-256=abc"],
      "x-nothing": undefined,
    } as IncomingHttpHeaders);

    expect(filtered).toEqual({
      host: "weights.example.com",
      "content-digest": ["sha-256=abc"],
    });
  });
});

describe("weight update signature verification", () => {
  test("a validly signed request verifies through the filtered headers", async () => {
    const body = JSON.stringify({ items: [] });
    const digest = `sha-256=${createHash("sha256").update(body).digest("base64")}`;
    const signedHeaders = await sign(WITH_DIGEST_FIELDS, {
      "content-digest": digest,
    });

    const filtered = FilterUndefinedHeaders(asIncomingHeaders(signedHeaders));

    expect(await verify(filtered, WITH_DIGEST_FIELDS)).toBe(true);
  });

  test("a validly signed request verifies with raw headers too (filtering is a no-op)", async () => {
    const signedHeaders = await sign(BASE_FIELDS);

    const raw = asIncomingHeaders(signedHeaders) as unknown as Record<
      string,
      string | string[]
    >;

    expect(await verify(FilterUndefinedHeaders(raw), BASE_FIELDS)).toBe(true);
    expect(await verify(raw, BASE_FIELDS)).toBe(true);
  });

  test("a tampered content-digest is rejected even after filtering", async () => {
    const signedHeaders = await sign(WITH_DIGEST_FIELDS, {
      "content-digest": `sha-256=${createHash("sha256").update("original").digest("base64")}`,
    });

    const tampered = asIncomingHeaders({
      ...signedHeaders,
      "content-digest": `sha-256=${createHash("sha256").update("tampered").digest("base64")}`,
    });

    expect(
      await verify(FilterUndefinedHeaders(tampered), WITH_DIGEST_FIELDS),
    ).toBe(false);
  });

  test("required content-digest field is enforced when present in fields", async () => {
    // Signed over the digest field, so a message that drops it entirely must fail
    const signedHeaders = await sign(WITH_DIGEST_FIELDS, {
      "content-digest": `sha-256=${createHash("sha256").update("body").digest("base64")}`,
    });
    const { "content-digest": _digest, ...withoutDigest } = signedHeaders;

    await expect(
      verify(FilterUndefinedHeaders(withoutDigest), WITH_DIGEST_FIELDS),
    ).rejects.toThrow();
  });
});
