import {
  ChallengeUpdateEvent,
  ScoreboardTriggerEvent,
  TeamUpdateEvent,
} from "@noctf/api/events";
import { MaxDate } from "../../util/date.ts";

export class ScoreboardCalculationState {
  private triggersCoveredBefore = 0;
  private teamsCoveredBefore = 0;
  private challengesCoveredBefore = 0;
  private lastProcessedEventTime: Date = new Date(0);
  private lastCalculationTime = Date.now();
  private nextVisibilityTime = Infinity;
  private hasCalculated = false;
  private teamTagsDirty = true;
  private lastTeamTagsRefresh = Date.now();

  shouldForceForEvent({
    subject,
    timestamp,
    forceTrigger = false,
  }: {
    subject: string;
    timestamp: Date;
    forceTrigger?: boolean;
  }): boolean {
    const eventTime = timestamp.getTime();
    if (subject === TeamUpdateEvent.$id!) {
      return eventTime >= this.teamsCoveredBefore;
    }
    if (subject === ChallengeUpdateEvent.$id!) {
      return eventTime >= this.challengesCoveredBefore;
    }
    if (subject === ScoreboardTriggerEvent.$id!) {
      return forceTrigger || eventTime >= this.triggersCoveredBefore;
    }
    return true;
  }

  isStale(now: number, maxIntervalMs: number): boolean {
    return (
      now >= this.nextVisibilityTime ||
      now - this.lastCalculationTime >= maxIntervalMs
    );
  }

  getNextVisibilityTime(): number {
    return this.nextVisibilityTime;
  }

  needsTeamTagsRefresh(now: number, intervalMs: number): boolean {
    return this.teamTagsDirty || now - this.lastTeamTagsRefresh >= intervalMs;
  }

  recordTeamTagsRefreshed(now: number) {
    this.teamTagsDirty = false;
    this.lastTeamTagsRefresh = now;
  }

  markTeamTagsDirty() {
    this.teamTagsDirty = true;
  }

  hasPendingEvents(eventTimestamp?: Date): boolean {
    if (eventTimestamp !== undefined) {
      return eventTimestamp.getTime() > this.lastProcessedEventTime.getTime();
    }
    return !this.hasCalculated && this.lastProcessedEventTime.getTime() === 0;
  }

  recordEventTimestamp(eventTimestamp: Date) {
    this.lastProcessedEventTime = MaxDate(
      this.lastProcessedEventTime,
      eventTimestamp,
    );
  }

  recordSuccess(opts: {
    startedAt: number;
    eventTimestamp?: Date;
    nextVisibilityTime: number;
    coversAllDivisions: boolean;
    refreshedTeamTags: boolean;
  }) {
    if (opts.coversAllDivisions) {
      this.triggersCoveredBefore = Math.max(
        this.triggersCoveredBefore,
        opts.startedAt,
      );
      this.challengesCoveredBefore = Math.max(
        this.challengesCoveredBefore,
        opts.startedAt,
      );
      if (opts.refreshedTeamTags) {
        this.teamsCoveredBefore = Math.max(
          this.teamsCoveredBefore,
          opts.startedAt,
        );
      }
    }
    this.hasCalculated = true;
    this.nextVisibilityTime = opts.nextVisibilityTime;
    this.lastCalculationTime = Date.now();
    if (opts.eventTimestamp) {
      this.recordEventTimestamp(opts.eventTimestamp);
    }
  }
}
