import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScoreboardService } from "./index.ts";
import { mockDeep } from "vitest-mock-extended";
import type { CacheService } from "../cache.ts";
import { Logger } from "../../types/primitives.ts";
import { ChallengeService } from "../challenge/index.ts";
import { ScoreService } from "../score.ts";
import { DatabaseClient } from "../../clients/database.ts";
import { SolveDAO } from "../../dao/solve.ts";
import { DivisionDAO } from "../../dao/division.ts";
import { ConfigService } from "../config.ts";

vi.mock(import("../../dao/division.ts"));
vi.mock(import("../../dao/solve.ts"));

describe(ScoreboardService, () => {
  const logger = mockDeep<Logger>();
  const cacheService = mockDeep<CacheService>();
  const challengeService = mockDeep<ChallengeService>();
  const configService = mockDeep<ConfigService>();
  const databaseClient = mockDeep<DatabaseClient>();
  const scoreService = mockDeep<ScoreService>();

  const divisionDAO = mockDeep<DivisionDAO>();
  const solveDAO = mockDeep<SolveDAO>();

  beforeEach(() => {
    cacheService.load.mockImplementation((_a, _b, fetcher) => fetcher());
    vi.mocked(DivisionDAO).mockReturnValue(divisionDAO);
    vi.mocked(SolveDAO).mockReturnValue(solveDAO);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("Fetches the scoreboard from cache", async () => {
    const svc = new ScoreboardService({
      logger,
      cacheService,
      challengeService,
      configService,
      databaseClient,
      scoreService,
    });
    cacheService.get.mockResolvedValueOnce(null).mockResolvedValueOnce({
      data: [],
      updated_at: new Date(1),
    });
    expect(await svc.getScoreboard(1)).toEqual({
      data: [],
      updated_at: new Date(0),
    });
    expect(await svc.getScoreboard(1)).toEqual({
      data: [],
      updated_at: new Date(1),
    });
  });
});
