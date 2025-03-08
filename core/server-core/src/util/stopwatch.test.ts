import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Stopwatch } from "./stopwatch.ts";

describe(Stopwatch, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("can be paused on creation", () => {
    const stopwatch = new Stopwatch(false);
    vi.advanceTimersByTime(1000);
    expect(stopwatch.elapsed()).to.eql(0);
  });

  it("counts upwards", () => {
    const stopwatch = new Stopwatch();
    vi.advanceTimersByTime(1000);
    expect(stopwatch.elapsed()).to.eql(1000);
  });

  it("is pausable", () => {
    const stopwatch = new Stopwatch();
    vi.advanceTimersByTime(1000);
    expect(stopwatch.elapsed()).to.eql(1000);
    stopwatch.pause();
    expect(stopwatch.isPaused()).to.eql(true);
    vi.advanceTimersByTime(1000);
    expect(stopwatch.elapsed()).to.eql(1000);
    stopwatch.resume();
    expect(stopwatch.isPaused()).to.eql(false);
    vi.advanceTimersByTime(1000);
    expect(stopwatch.elapsed()).to.eql(2000);
  });
});
