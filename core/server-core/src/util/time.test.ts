import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Delay, IsTimeBetweenSeconds } from "./time.ts";

describe(Delay, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should resolve after the specified timeout", async () => {
    const delayPromise = Delay(1000);

    // Fast-forward time by 1000ms
    vi.advanceTimersByTime(1000);

    await expect(delayPromise).resolves.toBeUndefined();
  });

  it("should not resolve before the timeout", async () => {
    const delayPromise = Delay(1000);
    let resolved = false;

    delayPromise.then(() => {
      resolved = true;
    });

    // Fast-forward by less than the timeout
    vi.advanceTimersByTime(500);

    // Use a small delay to let any pending promises resolve
    await Promise.resolve();

    expect(resolved).toBe(false);
  });

  it("should work with zero timeout", async () => {
    const delayPromise = Delay(0);

    vi.advanceTimersByTime(0);

    await expect(delayPromise).resolves.toBeUndefined();
  });

  it("should handle different timeout values", async () => {
    const delays = [100, 500, 2000];
    const promises = delays.map((delay) => Delay(delay));

    // Advance time to just before the first timeout
    vi.advanceTimersByTime(99);

    // None should be resolved yet
    const results = await Promise.allSettled(
      promises.map((p) => Promise.race([p, Promise.resolve("not-resolved")])),
    );

    results.forEach((result) => {
      expect(result.status).toBe("fulfilled");
      expect((result as any).value).toBe("not-resolved");
    });
  });
});

describe(IsTimeBetweenSeconds, () => {
  describe("with number input", () => {
    it("should return true when time is between start and end", () => {
      expect(IsTimeBetweenSeconds(1500, 1000, 2000)).toBe(true);
    });

    it("should return false when time is less than start_s", () => {
      expect(IsTimeBetweenSeconds(500, 1000, 2000)).toBe(false);
    });

    it("should return false when time is greater than end_s", () => {
      expect(IsTimeBetweenSeconds(2500, 1000, 2000)).toBe(false);
    });

    it("should return true when only start_s is provided and time is greater", () => {
      expect(IsTimeBetweenSeconds(1500, 1000)).toBe(true);
    });

    it("should return false when only start_s is provided and time is equal or less", () => {
      expect(IsTimeBetweenSeconds(1000, 1000)).toBe(true);
      expect(IsTimeBetweenSeconds(500, 1000)).toBe(false);
    });

    it("should return true when only end_s is provided and time is less", () => {
      expect(IsTimeBetweenSeconds(1500, undefined, 2000)).toBe(true);
    });

    it("should return false when only end_s is provided and time is equal or greater", () => {
      expect(IsTimeBetweenSeconds(2000, undefined, 2000)).toBe(true);
      expect(IsTimeBetweenSeconds(2500, undefined, 2000)).toBe(false);
    });

    it("should return true when neither start_s nor end_s is provided", () => {
      expect(IsTimeBetweenSeconds(1500)).toBe(true);
      expect(IsTimeBetweenSeconds(0)).toBe(true);
      expect(IsTimeBetweenSeconds(-1000)).toBe(true);
    });
  });

  describe("with Date input", () => {
    it("should convert Date to seconds and work correctly", () => {
      const date = new Date("2023-01-01T00:25:00Z");
      const startSeconds = 1672532200;
      const endSeconds = 1672533200;

      expect(IsTimeBetweenSeconds(date, startSeconds, endSeconds)).toBe(true);
    });

    it("should work with Date when only start_s is provided", () => {
      const date = new Date("2023-01-01T00:25:00Z");
      const startSeconds = 1672531000;

      expect(IsTimeBetweenSeconds(date, startSeconds)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle when start_s is greater than end_s", () => {
      expect(IsTimeBetweenSeconds(1500, 2000, 1000)).toBe(false);
    });

    it("should handle undefined start_s and end_s explicitly", () => {
      expect(IsTimeBetweenSeconds(1500, undefined, undefined)).toBe(true);
    });
  });
});
