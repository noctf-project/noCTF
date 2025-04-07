import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateThenable } from "./promises.ts";

describe(CreateThenable, () => {
  let mockFn: () => Promise<string>;
  let callCount: number;

  beforeEach(() => {
    callCount = 0;
    mockFn = vi.fn(() => {
      callCount++;
      return Promise.resolve("test-value");
    });
  });

  it("should not call the function immediately", () => {
    CreateThenable(mockFn);
    expect(mockFn).not.toHaveBeenCalled();
    expect(callCount).toBe(0);
  });

  it("should call the function when then is called", async () => {
    const thenable = CreateThenable(mockFn);
    const result = await thenable;

    expect(mockFn).toHaveBeenCalledOnce();
    expect(result).toBe("test-value");
  });

  it("should only call the function once across multiple then calls", async () => {
    const thenable = CreateThenable(mockFn);

    await thenable;
    await thenable;
    await thenable;

    expect(callCount).toBe(1);
  });

  it("should propagate resolved values through then chains", async () => {
    const thenable = CreateThenable(mockFn);

    const result = await thenable
      .then((value) => value.toUpperCase())
      .then((value) => `${value}-MODIFIED`);

    expect(result).toBe("TEST-VALUE-MODIFIED");
  });

  it("should handle rejection properly", async () => {
    const error = new Error("test error");
    const failingFn = vi.fn(() => Promise.reject(error));
    const thenable = CreateThenable(failingFn);

    let caught = null;
    try {
      await thenable;
    } catch (err) {
      caught = err;
    }

    expect(caught).toBe(error);
  });

  it("should allow rejection handling", async () => {
    const error = new Error("test error");
    const failingFn = vi.fn(() => Promise.reject(error));
    const thenable = CreateThenable(failingFn);

    const result = await thenable.then(
      (value) => `Success: ${value}`,
      (err) => `Error caught: ${err.message}`,
    );

    expect(result).toBe("Error caught: test error");
  });

  it("should work with async/await", async () => {
    const thenable = CreateThenable(mockFn);
    const value = await thenable;
    expect(value).toBe("test-value");
  });

  it("should maintain type transformations", async () => {
    interface User {
      id: number;
      name: string;
    }
    const userFn = vi.fn(() =>
      Promise.resolve({ id: 1, name: "Test User" } as User),
    );

    const thenable = CreateThenable(userFn);
    const userName = await thenable.then((user) => user.name);

    expect(userName).toBe("Test User");
  });
});
