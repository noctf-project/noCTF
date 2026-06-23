import { expect, test, vi, beforeEach, afterEach } from "vitest";
import { JWKSStore } from "./oauth_jwks.ts";
import type { KeyService } from "@noctf/server-core/services/key";

const mockStaticKey = Buffer.alloc(32, "a");
let mockKeyService: KeyService;

beforeEach(() => {
  mockKeyService = {
    deriveKey: vi.fn().mockReturnValue(mockStaticKey),
  } as unknown as KeyService;

  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("generates and stores public keys correctly", async () => {
  const mockTime = 1781438400000;
  vi.setSystemTime(mockTime);

  const store = new JWKSStore(mockKeyService, 86400000);
  const validKeys = await store.getValidKeys();

  expect(validKeys).toHaveLength(2);
  expect(validKeys[0].not_before).toBe(1781481600000);
  expect(validKeys[1].not_before).toBe(1781395200000);

  await expect(mockKeyService.deriveKey).toHaveBeenCalledWith(
    "auth:jwk:1781481600000",
  );
  await expect(mockKeyService.deriveKey).toHaveBeenCalledWith(
    "auth:jwk:1781395200000",
  );

  for (const key of validKeys) {
    expect(key.pub).toMatchObject({
      kty: "OKP",
      crv: "Ed25519",
      alg: "EdDSA",
      use: "sig",
    });
    expect(typeof key.pub.x).toBe("string");
    expect(typeof key.pub.kid).toBe("string");
  }
});

test("returns the correct active signing key based on time", async () => {
  vi.setSystemTime(864000000);
  const store1 = new JWKSStore(mockKeyService, 86400000);
  const signingKey1 = await store1.getSigningKey();
  expect(signingKey1.not_before).toBe(864000000);
  const validKeys1 = await store1.getValidKeys();
  expect(validKeys1[0].not_before).toBe(864000000);
  expect(validKeys1[1].not_before).toBe(777600000);

  vi.setSystemTime(854000000);
  const store2 = new JWKSStore(mockKeyService, 86400000);
  const signingKey2 = await store2.getSigningKey();
  expect(signingKey2.not_before).toBe(777600000);
  const validKeys2 = await store2.getValidKeys();
  expect(validKeys2[0].not_before).toBe(864000000);
  expect(validKeys2[1].not_before).toBe(777600000);
});

test("caches keys and does not recreate them within the same epoch", async () => {
  vi.setSystemTime(864000000);
  const store = new JWKSStore(mockKeyService, 86400000);

  await store.getSigningKey();
  await store.getValidKeys();
  await store.getSigningKey();

  await expect(mockKeyService.deriveKey).toHaveBeenCalledTimes(2);
});

test("rotates keys and generates new ones when time advances to next epoch", async () => {
  vi.setSystemTime(864000000);
  const store = new JWKSStore(mockKeyService, 86400000);

  await store.getSigningKey();
  await expect(mockKeyService.deriveKey).toHaveBeenCalledTimes(2);

  vi.setSystemTime(993600000);

  const signingKey = await store.getSigningKey();
  expect(signingKey.not_before).toBe(950400000);

  const validKeys = await store.getValidKeys();
  expect(validKeys[0].not_before).toBe(1036800000);
  expect(validKeys[1].not_before).toBe(950400000);

  await expect(mockKeyService.deriveKey).toHaveBeenCalledTimes(4);
});

test("properly handles key generation and signing key selection around the half-epoch boundary", async () => {
  const epoch = 86400000;
  const halfEpoch = Math.floor(epoch / 2);
  const baseEpoch = 864000000; // 10 days in ms

  // 1. Just before the half-epoch boundary
  const timeBefore = baseEpoch + halfEpoch - 1; // 907199999
  vi.setSystemTime(timeBefore);
  const storeBefore = new JWKSStore(mockKeyService, epoch);

  const signingKeyBefore = await storeBefore.getSigningKey();
  expect(signingKeyBefore.not_before).toBe(baseEpoch);

  const validKeysBefore = await storeBefore.getValidKeys();
  expect(validKeysBefore).toHaveLength(2);
  expect(validKeysBefore[0].not_before).toBe(baseEpoch);
  expect(validKeysBefore[1].not_before).toBe(baseEpoch - epoch);

  // 2. Exactly at the half-epoch boundary
  const timeAt = baseEpoch + halfEpoch; // 907200000
  vi.setSystemTime(timeAt);
  const storeAt = new JWKSStore(mockKeyService, epoch);

  const signingKeyAt = await storeAt.getSigningKey();
  // The signing key should still be the base epoch key
  expect(signingKeyAt.not_before).toBe(baseEpoch);

  const validKeysAt = await storeAt.getValidKeys();
  expect(validKeysAt).toHaveLength(2);
  expect(validKeysAt[0].not_before).toBe(baseEpoch + epoch);
  expect(validKeysAt[1].not_before).toBe(baseEpoch);
});

test("max token validity is half of key validity", async () => {
  const store = new JWKSStore(mockKeyService, 86400000);
  expect(store.getMaxMessageValidityMs()).toEqual(43200000);
});

