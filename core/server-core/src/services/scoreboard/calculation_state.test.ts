import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ChallengeUpdateEvent,
  ScoreboardTriggerEvent,
  TeamUpdateEvent,
} from "@noctf/api/events";
import { ScoreboardCalculationState } from "./calculation_state.ts";

describe(ScoreboardCalculationState, () => {
  afterEach(() => vi.useRealTimers());

  it("covers trigger and challenge events after a full calculation", () => {
    const state = new ScoreboardCalculationState();

    state.recordSuccess({
      startedAt: 100,
      nextVisibilityTime: Infinity,
      coversAllDivisions: true,
      refreshedTeamTags: false,
    });

    expect(
      state.shouldForceForEvent({
        subject: ScoreboardTriggerEvent.$id!,
        timestamp: new Date(99),
      }),
    ).toBe(false);
    expect(
      state.shouldForceForEvent({
        subject: ChallengeUpdateEvent.$id!,
        timestamp: new Date(99),
      }),
    ).toBe(false);
    expect(
      state.shouldForceForEvent({
        subject: TeamUpdateEvent.$id!,
        timestamp: new Date(99),
      }),
    ).toBe(true);
    expect(
      state.shouldForceForEvent({
        subject: ScoreboardTriggerEvent.$id!,
        timestamp: new Date(99),
        forceTrigger: true,
      }),
    ).toBe(true);
  });

  it("covers team events only when team tags were refreshed", () => {
    const state = new ScoreboardCalculationState();

    state.recordSuccess({
      startedAt: 100,
      nextVisibilityTime: Infinity,
      coversAllDivisions: true,
      refreshedTeamTags: true,
    });

    expect(
      state.shouldForceForEvent({
        subject: TeamUpdateEvent.$id!,
        timestamp: new Date(99),
      }),
    ).toBe(false);
    expect(
      state.shouldForceForEvent({
        subject: TeamUpdateEvent.$id!,
        timestamp: new Date(100),
      }),
    ).toBe(true);
  });

  it("tracks event and scheduled recalculation watermarks independently", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const state = new ScoreboardCalculationState();

    expect(state.hasPendingEvents()).toBe(true);
    state.recordSuccess({
      startedAt: 1_000,
      eventTimestamp: new Date(500),
      nextVisibilityTime: 2_000,
      coversAllDivisions: true,
      refreshedTeamTags: true,
    });

    expect(state.hasPendingEvents()).toBe(false);
    expect(state.hasPendingEvents(new Date(500))).toBe(false);
    expect(state.hasPendingEvents(new Date(501))).toBe(true);
    expect(state.isStale(1_999, 10_000)).toBe(false);
    expect(state.isStale(2_000, 10_000)).toBe(true);
  });
});
