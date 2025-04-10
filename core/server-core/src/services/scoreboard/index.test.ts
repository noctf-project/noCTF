import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScoreboardService } from "./index.ts";
import { mockDeep } from "vitest-mock-extended";
import type { CacheService } from "../cache.ts";
import { DivisionDAO } from "../../dao/division.ts";
import { ScoreboardDataLoader } from "./loader.ts";

vi.mock(import("../../dao/division.ts"));
vi.mock(import("./loader.ts"));

describe(ScoreboardService, () => {
  const cacheService = mockDeep<CacheService>();

  const scoreboardDataLoader = mockDeep<ScoreboardDataLoader>();
  const divisionDAO = mockDeep<DivisionDAO>();

  beforeEach(() => {
    cacheService.load.mockImplementation((_a, _b, fetcher) => fetcher());
    vi.mocked(ScoreboardDataLoader).mockReturnValue(scoreboardDataLoader);
    vi.mocked(DivisionDAO).mockReturnValue(divisionDAO);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("dummy test", () => {});
});
