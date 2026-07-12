import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ChallengeMetadataWithExpr,
  ComputeFullGraph,
  ComputeScoreboard,
  GetChangedTeamScores,
  PartitionSolvesByChallenge,
} from "./calc.ts";
import {
  Award,
  ChallengeMetadata,
  ChallengePrivateMetadataBase,
  ScoreboardEntry,
} from "@noctf/api/datatypes";
import { mockDeep } from "vitest-mock-extended";
import { Expression } from "expr-eval";
import { Timestamp } from "@noctf/schema";
import { HistoryDataPoint } from "../../dao/score_history.ts";
import { MinimalTeamInfo } from "../../dao/team.ts";
import { RawSolve } from "../../dao/submission.ts";

function MockEvaluateSolves(series: [number, number][]) {
  return ({ n }: { n: number }) => {
    let remain = n;
    for (const s of series) {
      if (remain - s[0] >= 0) {
        remain -= s[0];
        continue;
      }
      return s[1];
    }
    return series[series.length - 1][1];
  };
}

function MockEvaluateSolvesWithWeight(fn: (n: number, w: number) => number) {
  return (ctx: { n: number; w: number }) => fn(ctx.n, ctx.w);
}

describe(GetChangedTeamScores, () => {
  const expr = mockDeep<Expression>();
  beforeEach(() => {
    expr.variables.mockReturnValue(["ctx.n"]);
  });

  it("diff does not return any results if same everything", () => {
    const s1: ScoreboardEntry[] = [
      {
        team_id: 1,
        score: 1,
        rank: 1,
        last_solve: new Date(0),
        updated_at: new Date(0),
        hidden: false,
        tag_ids: [],
        awards: [],
        solves: [],
      },
      {
        team_id: 2,
        score: 2,
        rank: 2,
        last_solve: new Date(0),
        updated_at: new Date(0),
        hidden: false,
        tag_ids: [],
        awards: [],
        solves: [],
      },
    ];
    const s2: ScoreboardEntry[] = [
      {
        team_id: 1,
        score: 1,
        rank: 1,
        last_solve: new Date(0),
        updated_at: new Date(0),
        hidden: false,
        tag_ids: [],
        awards: [],
        solves: [],
      },
      {
        team_id: 2,
        score: 2,
        rank: 2,
        last_solve: new Date(0),
        updated_at: new Date(0),
        hidden: false,
        tag_ids: [],
        awards: [],
        solves: [],
      },
    ];
    expect(GetChangedTeamScores(s1, s2)).toEqual([]);
  });

  it("diff does not return any results if same score", () => {
    const s1: ScoreboardEntry[] = [
      {
        team_id: 1,
        score: 1,
        rank: 1,
        last_solve: new Date(0),
        updated_at: new Date(0),
        hidden: false,
        tag_ids: [],
        awards: [],
        solves: [],
      },
      {
        team_id: 2,
        score: 2,
        rank: 2,
        last_solve: new Date(0),
        updated_at: new Date(0),
        hidden: false,
        tag_ids: [],
        awards: [],
        solves: [],
      },
    ];
    const s2: ScoreboardEntry[] = [
      {
        team_id: 1,
        score: 1,
        rank: 1,
        last_solve: new Date(1),
        updated_at: new Date(1),
        hidden: false,
        tag_ids: [],
        awards: [],
        solves: [],
      },
      {
        team_id: 2,
        score: 2,
        rank: 2,
        last_solve: new Date(1),
        updated_at: new Date(1),
        hidden: false,
        tag_ids: [],
        awards: [],
        solves: [],
      },
    ];
    expect(GetChangedTeamScores(s1, s2)).toEqual([]);
  });

  it("diff cares if team score is added or removed", () => {
    const s1: HistoryDataPoint[] = [
      {
        team_id: 1,
        score: 1,
        updated_at: new Date(0),
      },
    ];
    const s2: HistoryDataPoint[] = [
      {
        team_id: 2,
        score: 2,
        updated_at: new Date(0),
      },
    ];
    expect(GetChangedTeamScores(s1, s2)).toEqual([
      {
        team_id: 2,
        score: 2,
        updated_at: new Date(0),
      },
      {
        team_id: 1,
        score: 0,
        updated_at: new Date(0),
      },
    ]);
  });

  it("diff cares if team score is changed", () => {
    const s1: HistoryDataPoint[] = [
      {
        team_id: 1,
        score: 1,
        updated_at: new Date(0),
      },
    ];
    const s2: HistoryDataPoint[] = [
      {
        team_id: 1,
        score: 10,
        updated_at: new Date(1000),
      },
    ];
    expect(GetChangedTeamScores(s1, s2)).toEqual([
      {
        team_id: 1,
        score: 10,
        updated_at: new Date(1000),
      },
    ]);
  });
});

describe(ComputeScoreboard, () => {
  const expr = mockDeep<Expression>();
  const mockToJSFunction = vi.fn();
  beforeEach(() => {
    expr.variables.mockReturnValue(["ctx.n"]);
    expr.simplify.mockReturnValue({
      toJSFunction: mockToJSFunction,
    } as any);
  });
  const challenge1: ChallengeMetadata = {
    id: 1,
    slug: "",
    title: "",
    private_metadata: {
      score: {
        params: {},
      },
    } as Pick<
      ChallengePrivateMetadataBase,
      "score"
    > as ChallengePrivateMetadataBase,
    tags: {},
    hidden: false,
    visible_at: null,
    created_at: new Date(0),
    updated_at: new Date(0),
  };

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("Does nothing if no results", () => {
    const result = ComputeScoreboard(new Map(), [], new Map(), []);
    expect(result).toEqual({
      last_event: new Date(0),
      scoreboard: [],
      challenges: new Map(),
    });
  });

  it("Value overrides for solves do not count towards dynamic scoring", () => {
    mockToJSFunction.mockReturnValue(() => 1);
    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1) as unknown as Timestamp & Date, // fuck TS
            updated_at: new Date(1) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 0,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 2,
            created_at: new Date(3) as unknown as Timestamp & Date, // fuck TS
            updated_at: new Date(3) as unknown as Timestamp & Date,
            team_id: 2,
            user_id: 2,
            value: 100,
            weight: 0,
          },
        ],
      ],
    ]);
    const result = ComputeScoreboard(
      new Map([
        [1, { id: 1, flags: [], division_id: 1, tag_ids: [] }],
        [2, { id: 2, flags: [], division_id: 1, tag_ids: [] }],
      ]),
      [
        {
          metadata: {
            ...challenge1,
            private_metadata: {
              ...challenge1.private_metadata,
              score: { ...challenge1.private_metadata.score, bonus: [2] },
            },
          },
          expr,
        },
      ],
      solvesByChallenge,
      [],
    );
    expect(result).toEqual({
      last_event: new Date(3),
      scoreboard: [
        {
          score: 100,
          updated_at: new Date(3),
          last_solve: new Date(3),
          team_id: 2,
          hidden: false,
          rank: 1,
          tag_ids: [],
          awards: [],
          solves: [
            expect.objectContaining({
              bonus: undefined,
              created_at: new Date(3),
              hidden: false,
              challenge_id: 1,
              value: 100,
              team_id: 2,
              user_id: 2,
            }),
          ],
        },
        {
          score: 3,
          updated_at: new Date(3),
          last_solve: new Date(1),
          team_id: 1,
          hidden: false,
          rank: 2,
          tag_ids: [],
          awards: [],
          solves: [
            expect.objectContaining({
              bonus: 2,
              created_at: new Date(1),
              hidden: false,
              challenge_id: 1,
              value: 3,
              team_id: 1,
              user_id: 1,
            }),
          ],
        },
      ],
      challenges: new Map([
        [
          1,
          {
            challenge_id: 1,
            value: 1,
            solves: [
              {
                bonus: 2,
                created_at: new Date(1),
                hidden: false,
                challenge_id: 1,
                value: 3,
                team_id: 1,
                user_id: 1,
              },
              {
                bonus: undefined,
                created_at: new Date(3),
                hidden: false,
                challenge_id: 1,
                value: 100,
                team_id: 2,
                user_id: 2,
              },
            ],
          },
        ],
      ]),
    });
    mockToJSFunction.mockReturnValue(() => 1);
  });

  it("Calculates challenge scores, uses the last valid solve date as the date", () => {
    mockToJSFunction.mockReturnValue(() => 1);
    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1) as unknown as Timestamp & Date, // fuck TS
            updated_at: new Date(1) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 0,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 2,
            created_at: new Date(2) as unknown as Timestamp & Date, // fuck TS
            updated_at: new Date(2) as unknown as Timestamp & Date,
            team_id: 3,
            user_id: 3,
            value: null,
            weight: 0,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 2,
            created_at: new Date(3) as unknown as Timestamp & Date, // fuck TS
            updated_at: new Date(3) as unknown as Timestamp & Date,
            team_id: 2,
            user_id: 2,
            value: null,
            weight: 0,
          },
        ],
      ],
    ]);
    const result = ComputeScoreboard(
      new Map([
        [1, { id: 1, flags: [], division_id: 1, tag_ids: [] }],
        [2, { id: 2, flags: [], division_id: 1, tag_ids: [] }],
        [3, { id: 3, flags: [], division_id: 1, tag_ids: [] }],
      ]),
      [
        {
          metadata: challenge1,
          expr,
        },
      ],
      solvesByChallenge,
      [],
    );
    expect(result).toEqual({
      last_event: new Date(3),
      scoreboard: [
        {
          score: 1,
          updated_at: new Date(3),
          last_solve: new Date(1),
          team_id: 1,
          hidden: false,
          rank: 1,
          tag_ids: [],
          awards: [],
          solves: [
            expect.objectContaining({
              bonus: undefined,
              created_at: new Date(1),
              hidden: false,
              challenge_id: 1,
              value: 1,
            }),
          ],
        },
        {
          score: 1,
          updated_at: new Date(3),
          last_solve: new Date(2),
          team_id: 3,
          hidden: false,
          rank: 2,
          tag_ids: [],
          awards: [],
          solves: [
            expect.objectContaining({
              bonus: undefined,
              created_at: new Date(2),
              hidden: false,
              challenge_id: 1,
              value: 1,
            }),
          ],
        },
        {
          score: 1,
          updated_at: new Date(3),
          last_solve: new Date(3),
          team_id: 2,
          hidden: false,
          rank: 3,
          tag_ids: [],
          awards: [],
          solves: [
            expect.objectContaining({
              bonus: undefined,
              created_at: new Date(3),
              hidden: false,
              challenge_id: 1,
              value: 1,
            }),
          ],
        },
      ],
      challenges: new Map([
        [
          1,
          {
            challenge_id: 1,
            value: 1,
            solves: [
              {
                bonus: undefined,
                created_at: new Date(1),
                hidden: false,
                challenge_id: 1,
                value: 1,
                team_id: 1,
                user_id: 1,
              },
              {
                bonus: undefined,
                created_at: new Date(2),
                hidden: false,
                challenge_id: 1,
                value: 1,
                team_id: 3,
                user_id: 3,
              },
              {
                bonus: undefined,
                created_at: new Date(3),
                hidden: false,
                challenge_id: 1,
                value: 1,
                team_id: 2,
                user_id: 2,
              },
            ],
          },
        ],
      ]),
    });
  });

  it("Calculates challenge scores and adds awards to date", () => {
    mockToJSFunction.mockReturnValue(() => 1);
    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1) as unknown as Timestamp & Date,
            updated_at: new Date(1) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 0,
          },
        ],
      ],
    ]);
    const result = ComputeScoreboard(
      new Map([
        [1, { id: 1, flags: [], division_id: 1, tag_ids: [] }],
        [2, { id: 2, flags: [], division_id: 1, tag_ids: [] }],
      ]),
      [
        {
          metadata: challenge1,
          expr,
        },
      ],
      solvesByChallenge,
      [
        {
          created_at: new Date(2),
          id: 1,
          team_id: 1,
          title: "test",
          value: 1,
        },
        {
          created_at: new Date(3),
          id: 2,
          team_id: 2,
          title: "test",
          value: 3,
        },
      ],
    );
    expect(result).toEqual({
      last_event: new Date(3),
      scoreboard: [
        {
          score: 3,
          last_solve: new Date(0),
          updated_at: new Date(3),
          team_id: 2,
          rank: 1,
          hidden: false,
          tag_ids: [],
          awards: [
            expect.objectContaining({
              created_at: new Date(3),
              id: 2,
              title: "test",
              value: 3,
            }),
          ],
          solves: [],
        },
        {
          score: 2,
          last_solve: new Date(1),
          updated_at: new Date(2),
          team_id: 1,
          rank: 2,
          hidden: false,
          tag_ids: [],
          awards: [
            expect.objectContaining({
              created_at: new Date(2),
              id: 1,
              title: "test",
              value: 1,
            }),
          ],
          solves: [
            {
              bonus: undefined,
              created_at: new Date(1),
              hidden: false,
              challenge_id: 1,
              value: 1,
              team_id: 1,
              user_id: 1,
            },
          ],
        },
      ],
      challenges: new Map([
        [
          1,
          {
            challenge_id: 1,
            value: 1,
            solves: [
              {
                bonus: undefined,
                created_at: new Date(1),
                hidden: false,
                challenge_id: 1,
                value: 1,
                team_id: 1,
                user_id: 1,
              },
            ],
          },
        ],
      ]),
    });
  });
});

describe(ComputeFullGraph, () => {
  const expr = mockDeep<Expression>();
  const mockToJSFunction = vi.fn();
  beforeEach(() => {
    expr.variables.mockReturnValue(["ctx.n"]);
    expr.simplify.mockReturnValue({
      toJSFunction: mockToJSFunction,
    } as any);
  });

  const challenge1: ChallengeMetadata = {
    id: 1,
    slug: "",
    title: "",
    private_metadata: {
      score: {
        params: {},
      },
    } as Pick<
      ChallengePrivateMetadataBase,
      "score"
    > as ChallengePrivateMetadataBase,
    tags: {},
    hidden: false,
    visible_at: null,
    created_at: new Date(0),
    updated_at: new Date(0),
  };

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should compute score history with empty data", () => {
    const teams = new Map<number, MinimalTeamInfo>();
    const challenges: ChallengeMetadataWithExpr[] = [];
    const solvesByChallenge = new Map<number, RawSolve[]>();
    const awards: Award[] = [];

    const result = ComputeFullGraph(
      teams,
      challenges,
      solvesByChallenge,
      awards,
    );

    expect(result).toEqual([]);
  });

  it("should compute score history with a single solve and awards", () => {
    mockToJSFunction.mockReturnValue(
      MockEvaluateSolves([
        [2, 500],
        [2, 400],
      ]),
    );

    const teams = new Map<number, MinimalTeamInfo>([
      [1, { id: 1, division_id: 1, tag_ids: [], flags: [] }],
      [2, { id: 2, division_id: 1, tag_ids: [], flags: [] }],
    ]);
    const awards = [
      {
        created_at: new Date(2005),
        id: 1,
        team_id: 1,
        title: "test",
        value: 1,
      },
      {
        created_at: new Date(2102),
        id: 1,
        team_id: 1,
        title: "test2",
        value: 5,
      },
      {
        created_at: new Date(3234),
        id: 2,
        team_id: 2,
        title: "test",
        value: 3,
      },
    ];
    const challenges = [
      {
        metadata: challenge1,
        expr,
      },
    ];
    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1203) as unknown as Timestamp & Date,
            updated_at: new Date(1203) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 0,
          },
        ],
      ],
    ]);

    const resultsDefaultSample = ComputeFullGraph(
      teams,
      challenges,
      solvesByChallenge,
      awards,
    );
    expect(resultsDefaultSample).toEqual([
      { score: 500, team_id: 1, updated_at: new Date(1000) },
      { score: 506, team_id: 1, updated_at: new Date(2000) },
      { score: 3, team_id: 2, updated_at: new Date(3000) },
    ]);

    const resultHighSample = ComputeFullGraph(
      teams,
      challenges,
      solvesByChallenge,
      awards,
      1,
    );
    expect(resultHighSample).toEqual([
      { score: 500, team_id: 1, updated_at: new Date(1203) },
      { score: 501, team_id: 1, updated_at: new Date(2005) },
      { score: 506, team_id: 1, updated_at: new Date(2102) },
      { score: 3, team_id: 2, updated_at: new Date(3234) },
    ]);
  });

  it("should compute score history with retroactive score adjustment on tier change", () => {
    mockToJSFunction.mockReturnValue(
      MockEvaluateSolves([
        [2, 500],
        [2, 400],
      ]),
    );

    const teams = new Map<number, MinimalTeamInfo>([
      [1, { id: 1, division_id: 1, tag_ids: [], flags: [] }],
      [2, { id: 2, division_id: 1, tag_ids: [], flags: [] }],
    ]);
    const awards = [
      {
        created_at: new Date(2005),
        id: 1,
        team_id: 1,
        title: "test",
        value: 1,
      },
      {
        created_at: new Date(2102),
        id: 1,
        team_id: 1,
        title: "test2",
        value: 5,
      },
      {
        created_at: new Date(3234),
        id: 2,
        team_id: 2,
        title: "test",
        value: 3,
      },
    ];
    const challenges = [
      {
        metadata: challenge1,
        expr,
      },
    ];
    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1203) as unknown as Timestamp & Date,
            updated_at: new Date(1203) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 0,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(2001) as unknown as Timestamp & Date,
            updated_at: new Date(2001) as unknown as Timestamp & Date,
            team_id: 2,
            user_id: 2,
            value: null,
            weight: 0,
          },
        ],
      ],
    ]);

    const resultsDefaultSample = ComputeFullGraph(
      teams,
      challenges,
      solvesByChallenge,
      awards,
    );
    expect(resultsDefaultSample).toEqual([
      { score: 500, team_id: 1, updated_at: new Date(1000) },
      { score: 406, team_id: 1, updated_at: new Date(2000) },
      { score: 400, team_id: 2, updated_at: new Date(2000) },
      { score: 403, team_id: 2, updated_at: new Date(3000) },
    ]);

    const resultsHighSample = ComputeFullGraph(
      teams,
      challenges,
      solvesByChallenge,
      awards,
      1,
    );
    expect(resultsHighSample).toEqual([
      { score: 500, team_id: 1, updated_at: new Date(1203) },
      { score: 400, team_id: 1, updated_at: new Date(2001) },
      { score: 401, team_id: 1, updated_at: new Date(2005) },
      { score: 406, team_id: 1, updated_at: new Date(2102) },
      { score: 400, team_id: 2, updated_at: new Date(2001) },
      { score: 403, team_id: 2, updated_at: new Date(3234) },
    ]);
  });

  it("should ignore hidden teams and results", () => {
    mockToJSFunction.mockReturnValue(
      MockEvaluateSolves([
        [2, 500],
        [2, 400],
      ]),
    );

    const teams = new Map<number, MinimalTeamInfo>([
      [1, { id: 1, division_id: 1, tag_ids: [], flags: [] }],
      [2, { id: 2, division_id: 1, tag_ids: [], flags: ["hidden"] }],
    ]);
    const awards = [
      {
        created_at: new Date(2005),
        id: 1,
        team_id: 1,
        title: "test",
        value: 1,
      },
      {
        created_at: new Date(2102),
        id: 1,
        team_id: 1,
        title: "test2",
        value: 5,
      },
      {
        created_at: new Date(3234),
        id: 2,
        team_id: 2,
        title: "test",
        value: 3,
      },
    ];
    const challenges = [
      {
        metadata: challenge1,
        expr,
      },
      {
        metadata: { ...challenge1, id: 2 },
        expr,
      },
    ];
    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1203) as unknown as Timestamp & Date,
            updated_at: new Date(1203) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 0,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1203) as unknown as Timestamp & Date,
            updated_at: new Date(1203) as unknown as Timestamp & Date,
            team_id: 2,
            user_id: 2,
            value: null,
            weight: 0,
          },
        ],
      ],
      [
        2,
        [
          {
            challenge_id: 2,
            hidden: true,
            id: 2,
            created_at: new Date(2001) as unknown as Timestamp & Date,
            updated_at: new Date(2001) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 0,
          },
        ],
      ],
    ]);

    const results = ComputeFullGraph(
      teams,
      challenges,
      solvesByChallenge,
      awards,
      1,
    );
    expect(results).toEqual([
      { score: 500, team_id: 1, updated_at: new Date(1203) },
      { score: 501, team_id: 1, updated_at: new Date(2005) },
      { score: 506, team_id: 1, updated_at: new Date(2102) },
    ]);
  });
});

describe("Solve count and weight scoring", () => {
  const expr = mockDeep<Expression>();
  const mockToJSFunction = vi.fn();
  beforeEach(() => {
    expr.simplify.mockReturnValue({
      toJSFunction: mockToJSFunction,
    } as any);
  });
  const challenge1: ChallengeMetadata = {
    id: 1,
    slug: "",
    title: "",
    private_metadata: {
      score: {
        params: {},
      },
    } as Pick<
      ChallengePrivateMetadataBase,
      "score"
    > as ChallengePrivateMetadataBase,
    tags: {},
    hidden: false,
    visible_at: null,
    created_at: new Date(0),
    updated_at: new Date(0),
  };

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("solves with different weights produce different scores when expression uses ctx.w", () => {
    // score = 1000 - (n * 10) + (w * 5)
    expr.variables.mockReturnValue(["ctx.n", "ctx.w"]);
    mockToJSFunction.mockReturnValue(
      MockEvaluateSolvesWithWeight((n, w) => 1000 - n * 10 + w * 5),
    );

    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1000) as unknown as Timestamp & Date,
            updated_at: new Date(1000) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 0,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 2,
            created_at: new Date(2000) as unknown as Timestamp & Date,
            updated_at: new Date(2000) as unknown as Timestamp & Date,
            team_id: 2,
            user_id: 2,
            value: null,
            weight: 10,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 3,
            created_at: new Date(3000) as unknown as Timestamp & Date,
            updated_at: new Date(3000) as unknown as Timestamp & Date,
            team_id: 3,
            user_id: 3,
            value: null,
            weight: 20,
          },
        ],
      ],
    ]);

    const result = ComputeScoreboard(
      new Map([
        [1, { id: 1, flags: [], division_id: 1, tag_ids: [] }],
        [2, { id: 2, flags: [], division_id: 1, tag_ids: [] }],
        [3, { id: 3, flags: [], division_id: 1, tag_ids: [] }],
      ]),
      [{ metadata: challenge1, expr }],
      solvesByChallenge,
      [],
    );

    // n = 3 (all are dynamic solves)
    // team1: w=0  => 1000 - 30 + 0  = 970
    // team2: w=10 => 1000 - 30 + 50 = 1020
    // team3: w=20 => 1000 - 30 + 100 = 1070
    const team1 = result.scoreboard.find((s) => s.team_id === 1)!;
    const team2 = result.scoreboard.find((s) => s.team_id === 2)!;
    const team3 = result.scoreboard.find((s) => s.team_id === 3)!;

    expect(team1.score).toBe(970);
    expect(team2.score).toBe(1020);
    expect(team3.score).toBe(1070);
    // Higher weight = higher score = better rank
    expect(team3.rank).toBe(1);
    expect(team2.rank).toBe(2);
    expect(team1.rank).toBe(3);
  });

  it("weight=0 for all solves uses only solve count (n)", () => {
    expr.variables.mockReturnValue(["ctx.n"]);
    mockToJSFunction.mockReturnValue(
      MockEvaluateSolvesWithWeight((n, _w) => 500 - n * 50),
    );

    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1000) as unknown as Timestamp & Date,
            updated_at: new Date(1000) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 0,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 2,
            created_at: new Date(2000) as unknown as Timestamp & Date,
            updated_at: new Date(2000) as unknown as Timestamp & Date,
            team_id: 2,
            user_id: 2,
            value: null,
            weight: 0,
          },
        ],
      ],
    ]);

    const result = ComputeScoreboard(
      new Map([
        [1, { id: 1, flags: [], division_id: 1, tag_ids: [] }],
        [2, { id: 2, flags: [], division_id: 1, tag_ids: [] }],
      ]),
      [{ metadata: challenge1, expr }],
      solvesByChallenge,
      [],
    );

    // n=2, w=0 for both => 500 - 100 = 400
    const team1 = result.scoreboard.find((s) => s.team_id === 1)!;
    const team2 = result.scoreboard.find((s) => s.team_id === 2)!;
    expect(team1.score).toBe(400);
    expect(team2.score).toBe(400);
  });

  it("value overrides bypass weight-based scoring", () => {
    expr.variables.mockReturnValue(["ctx.n", "ctx.w"]);
    mockToJSFunction.mockReturnValue(
      MockEvaluateSolvesWithWeight((n, w) => 100 + w * 10 - n),
    );

    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1000) as unknown as Timestamp & Date,
            updated_at: new Date(1000) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 5,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 2,
            created_at: new Date(2000) as unknown as Timestamp & Date,
            updated_at: new Date(2000) as unknown as Timestamp & Date,
            team_id: 2,
            user_id: 2,
            value: 999,
            weight: 50,
          },
        ],
      ],
    ]);

    const result = ComputeScoreboard(
      new Map([
        [1, { id: 1, flags: [], division_id: 1, tag_ids: [] }],
        [2, { id: 2, flags: [], division_id: 1, tag_ids: [] }],
      ]),
      [{ metadata: challenge1, expr }],
      solvesByChallenge,
      [],
    );

    const team1 = result.scoreboard.find((s) => s.team_id === 1)!;
    const team2 = result.scoreboard.find((s) => s.team_id === 2)!;

    // team2 has value override = 999, so weight is irrelevant
    expect(team2.score).toBe(999);
    // team1: n=1 (only 1 dynamic solve), w=5 => 100 + 50 - 1 = 149
    expect(team1.score).toBe(149);
  });

  it("hidden solves receive weight-based scores but do not contribute to team score", () => {
    expr.variables.mockReturnValue(["ctx.n", "ctx.w"]);
    mockToJSFunction.mockReturnValue(
      MockEvaluateSolvesWithWeight((n, w) => 200 + w * 3 - n * 10),
    );

    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1000) as unknown as Timestamp & Date,
            updated_at: new Date(1000) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 4,
          },
        ],
      ],
    ]);

    const result = ComputeScoreboard(
      new Map([
        [1, { id: 1, flags: [], division_id: 1, tag_ids: [] }],
        [2, { id: 2, flags: ["hidden"], division_id: 1, tag_ids: [] }],
      ]),
      [{ metadata: challenge1, expr }],
      solvesByChallenge,
      [],
    );

    const team1 = result.scoreboard.find((s) => s.team_id === 1)!;
    // n=1, w=4 => 200 + 12 - 10 = 202
    expect(team1.score).toBe(202);
  });

  it("challenge value defaults to w=0 when computing display value", () => {
    expr.variables.mockReturnValue(["ctx.n", "ctx.w"]);
    mockToJSFunction.mockReturnValue(
      MockEvaluateSolvesWithWeight((n, w) => 500 - n * 10 + w * 100),
    );

    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1000) as unknown as Timestamp & Date,
            updated_at: new Date(1000) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 7,
          },
        ],
      ],
    ]);

    const result = ComputeScoreboard(
      new Map([[1, { id: 1, flags: [], division_id: 1, tag_ids: [] }]]),
      [{ metadata: challenge1, expr }],
      solvesByChallenge,
      [],
    );

    // Challenge display value uses memo(n, 0) => 500 - 10 + 0 = 490
    const challengeData = result.challenges.get(1)!;
    expect(challengeData.value).toBe(490);

    // But the solve itself uses weight=7 => 500 - 10 + 700 = 1190
    const team1 = result.scoreboard.find((s) => s.team_id === 1)!;
    expect(team1.score).toBe(1190);
  });

  it("ComputeFullGraph emits retroactive adjustments with weights", () => {
    expr.variables.mockReturnValue(["ctx.n", "ctx.w"]);
    mockToJSFunction.mockReturnValue(
      MockEvaluateSolvesWithWeight((n, w) => 1000 - n * 100 + w * 10),
    );

    const teams = new Map<number, MinimalTeamInfo>([
      [1, { id: 1, division_id: 1, tag_ids: [], flags: [] }],
      [2, { id: 2, division_id: 1, tag_ids: [], flags: [] }],
    ]);

    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1000) as unknown as Timestamp & Date,
            updated_at: new Date(1000) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 5,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 2,
            created_at: new Date(2000) as unknown as Timestamp & Date,
            updated_at: new Date(2000) as unknown as Timestamp & Date,
            team_id: 2,
            user_id: 2,
            value: null,
            weight: 3,
          },
        ],
      ],
    ]);

    const result = ComputeFullGraph(
      teams,
      [{ metadata: challenge1, expr }],
      solvesByChallenge,
      [],
      1,
    );

    // At t=1000: n=1, team1 w=5 => 1000 - 100 + 50 = 950
    // At t=2000: n=2, team2 w=3 => 1000 - 200 + 30 = 830
    //   retroactive for team1: n=2, w=5 => 1000 - 200 + 50 = 850 (delta = 850-950 = -100)
    expect(result).toEqual([
      { score: 950, team_id: 1, updated_at: new Date(1000) },
      { score: 850, team_id: 1, updated_at: new Date(2000) },
      { score: 830, team_id: 2, updated_at: new Date(2000) },
    ]);
  });
});

describe("MemoizeScore black-box cache", () => {
  const expr = mockDeep<Expression>();
  const mockToJSFunction = vi.fn();
  beforeEach(() => {
    expr.simplify.mockReturnValue({
      toJSFunction: mockToJSFunction,
    } as any);
  });
  const challenge1: ChallengeMetadata = {
    id: 1,
    slug: "",
    title: "",
    private_metadata: {
      score: {
        params: {},
      },
    } as Pick<
      ChallengePrivateMetadataBase,
      "score"
    > as ChallengePrivateMetadataBase,
    tags: {},
    hidden: false,
    visible_at: null,
    created_at: new Date(0),
    updated_at: new Date(0),
  };

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("cache returns consistent results for identical (n, w) inputs", () => {
    expr.variables.mockReturnValue(["ctx.n", "ctx.w"]);
    let callCount = 0;
    mockToJSFunction.mockReturnValue((ctx: { n: number; w: number }) => {
      callCount++;
      return 100 * ctx.n + ctx.w;
    });

    // Two solves with the same weight => same (n, w) pair
    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1000) as unknown as Timestamp & Date,
            updated_at: new Date(1000) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 5,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 2,
            created_at: new Date(2000) as unknown as Timestamp & Date,
            updated_at: new Date(2000) as unknown as Timestamp & Date,
            team_id: 2,
            user_id: 2,
            value: null,
            weight: 5,
          },
        ],
      ],
    ]);

    const result = ComputeScoreboard(
      new Map([
        [1, { id: 1, flags: [], division_id: 1, tag_ids: [] }],
        [2, { id: 2, flags: [], division_id: 1, tag_ids: [] }],
      ]),
      [{ metadata: challenge1, expr }],
      solvesByChallenge,
      [],
    );

    const team1 = result.scoreboard.find((s) => s.team_id === 1)!;
    const team2 = result.scoreboard.find((s) => s.team_id === 2)!;

    // Both should get memo(2, 5) = 200 + 5 = 205
    expect(team1.score).toBe(205);
    expect(team2.score).toBe(205);
  });

  it("cache differentiates between different (n, w) pairs", () => {
    expr.variables.mockReturnValue(["ctx.n", "ctx.w"]);
    mockToJSFunction.mockReturnValue(
      MockEvaluateSolvesWithWeight((n, w) => n * 100 + w),
    );

    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1000) as unknown as Timestamp & Date,
            updated_at: new Date(1000) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 10,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 2,
            created_at: new Date(2000) as unknown as Timestamp & Date,
            updated_at: new Date(2000) as unknown as Timestamp & Date,
            team_id: 2,
            user_id: 2,
            value: null,
            weight: 20,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 3,
            created_at: new Date(3000) as unknown as Timestamp & Date,
            updated_at: new Date(3000) as unknown as Timestamp & Date,
            team_id: 3,
            user_id: 3,
            value: null,
            weight: 10,
          },
        ],
      ],
    ]);

    const result = ComputeScoreboard(
      new Map([
        [1, { id: 1, flags: [], division_id: 1, tag_ids: [] }],
        [2, { id: 2, flags: [], division_id: 1, tag_ids: [] }],
        [3, { id: 3, flags: [], division_id: 1, tag_ids: [] }],
      ]),
      [{ metadata: challenge1, expr }],
      solvesByChallenge,
      [],
    );

    // n=3 for all; w differs
    // team1: memo(3, 10) = 310
    // team2: memo(3, 20) = 320
    // team3: memo(3, 10) = 310 (should match team1 from cache)
    const team1 = result.scoreboard.find((s) => s.team_id === 1)!;
    const team2 = result.scoreboard.find((s) => s.team_id === 2)!;
    const team3 = result.scoreboard.find((s) => s.team_id === 3)!;

    expect(team1.score).toBe(310);
    expect(team2.score).toBe(320);
    expect(team3.score).toBe(310);
  });

  it("cache works when expression uses only ctx.n (no ctx.w)", () => {
    expr.variables.mockReturnValue(["ctx.n"]);
    mockToJSFunction.mockReturnValue(
      MockEvaluateSolvesWithWeight((n, _w) => 1000 - n * 100),
    );

    // Different weights should not matter since expr doesn't use ctx.w
    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1000) as unknown as Timestamp & Date,
            updated_at: new Date(1000) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 99,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 2,
            created_at: new Date(2000) as unknown as Timestamp & Date,
            updated_at: new Date(2000) as unknown as Timestamp & Date,
            team_id: 2,
            user_id: 2,
            value: null,
            weight: 1,
          },
        ],
      ],
    ]);

    const result = ComputeScoreboard(
      new Map([
        [1, { id: 1, flags: [], division_id: 1, tag_ids: [] }],
        [2, { id: 2, flags: [], division_id: 1, tag_ids: [] }],
      ]),
      [{ metadata: challenge1, expr }],
      solvesByChallenge,
      [],
    );

    // n=2 for both, w is ignored => 1000 - 200 = 800
    const team1 = result.scoreboard.find((s) => s.team_id === 1)!;
    const team2 = result.scoreboard.find((s) => s.team_id === 2)!;
    expect(team1.score).toBe(800);
    expect(team2.score).toBe(800);
  });

  it("cache works when expression uses only ctx.w (no ctx.n)", () => {
    expr.variables.mockReturnValue(["ctx.w"]);
    mockToJSFunction.mockReturnValue(
      MockEvaluateSolvesWithWeight((_n, w) => w * 50),
    );

    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1000) as unknown as Timestamp & Date,
            updated_at: new Date(1000) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 3,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 2,
            created_at: new Date(2000) as unknown as Timestamp & Date,
            updated_at: new Date(2000) as unknown as Timestamp & Date,
            team_id: 2,
            user_id: 2,
            value: null,
            weight: 7,
          },
        ],
      ],
    ]);

    const result = ComputeScoreboard(
      new Map([
        [1, { id: 1, flags: [], division_id: 1, tag_ids: [] }],
        [2, { id: 2, flags: [], division_id: 1, tag_ids: [] }],
      ]),
      [{ metadata: challenge1, expr }],
      solvesByChallenge,
      [],
    );

    // w=3 => 150, w=7 => 350
    const team1 = result.scoreboard.find((s) => s.team_id === 1)!;
    const team2 = result.scoreboard.find((s) => s.team_id === 2)!;
    expect(team1.score).toBe(150);
    expect(team2.score).toBe(350);
  });

  it("cache works when expression uses neither ctx.n nor ctx.w (static)", () => {
    expr.variables.mockReturnValue([]);
    mockToJSFunction.mockReturnValue(
      MockEvaluateSolvesWithWeight((_n, _w) => 42),
    );

    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1000) as unknown as Timestamp & Date,
            updated_at: new Date(1000) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 100,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 2,
            created_at: new Date(2000) as unknown as Timestamp & Date,
            updated_at: new Date(2000) as unknown as Timestamp & Date,
            team_id: 2,
            user_id: 2,
            value: null,
            weight: 200,
          },
        ],
      ],
    ]);

    const result = ComputeScoreboard(
      new Map([
        [1, { id: 1, flags: [], division_id: 1, tag_ids: [] }],
        [2, { id: 2, flags: [], division_id: 1, tag_ids: [] }],
      ]),
      [{ metadata: challenge1, expr }],
      solvesByChallenge,
      [],
    );

    // Static expression: always 42 regardless of n or w
    const team1 = result.scoreboard.find((s) => s.team_id === 1)!;
    const team2 = result.scoreboard.find((s) => s.team_id === 2)!;
    expect(team1.score).toBe(42);
    expect(team2.score).toBe(42);
    expect(result.challenges.get(1)!.value).toBe(42);
  });

  it("recomputing scoreboard with a fresh MemoizeScore produces same results", () => {
    expr.variables.mockReturnValue(["ctx.n", "ctx.w"]);
    mockToJSFunction.mockReturnValue(
      MockEvaluateSolvesWithWeight((n, w) => 500 - n * 25 + w * 3),
    );

    const teams = new Map<number, MinimalTeamInfo>([
      [1, { id: 1, flags: [], division_id: 1, tag_ids: [] }],
      [2, { id: 2, flags: [], division_id: 1, tag_ids: [] }],
      [3, { id: 3, flags: [], division_id: 1, tag_ids: [] }],
    ]);

    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1000) as unknown as Timestamp & Date,
            updated_at: new Date(1000) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 0,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 2,
            created_at: new Date(2000) as unknown as Timestamp & Date,
            updated_at: new Date(2000) as unknown as Timestamp & Date,
            team_id: 2,
            user_id: 2,
            value: null,
            weight: 15,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 3,
            created_at: new Date(3000) as unknown as Timestamp & Date,
            updated_at: new Date(3000) as unknown as Timestamp & Date,
            team_id: 3,
            user_id: 3,
            value: null,
            weight: 15,
          },
        ],
      ],
    ]);

    const challenges: ChallengeMetadataWithExpr[] = [
      { metadata: challenge1, expr },
    ];

    // First computation (populates cache internally)
    const result1 = ComputeScoreboard(teams, challenges, solvesByChallenge, []);

    // Second computation (fresh MemoizeScore, but same inputs)
    const result2 = ComputeScoreboard(teams, challenges, solvesByChallenge, []);

    // Results must be identical
    expect(
      result1.scoreboard.map((s) => ({ id: s.team_id, score: s.score })),
    ).toEqual(
      result2.scoreboard.map((s) => ({ id: s.team_id, score: s.score })),
    );
    expect(result1.challenges.get(1)!.value).toBe(
      result2.challenges.get(1)!.value,
    );
  });

  it("cache handles many distinct weight values correctly across challenges", () => {
    expr.variables.mockReturnValue(["ctx.n", "ctx.w"]);
    mockToJSFunction.mockReturnValue(
      MockEvaluateSolvesWithWeight((n, w) => n + w),
    );

    const challenge2: ChallengeMetadata = {
      ...challenge1,
      id: 2,
    };

    const solvesByChallenge = new Map<number, RawSolve[]>([
      [
        1,
        [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1000) as unknown as Timestamp & Date,
            updated_at: new Date(1000) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 10,
          },
        ],
      ],
      [
        2,
        [
          {
            challenge_id: 2,
            hidden: false,
            id: 2,
            created_at: new Date(2000) as unknown as Timestamp & Date,
            updated_at: new Date(2000) as unknown as Timestamp & Date,
            team_id: 1,
            user_id: 1,
            value: null,
            weight: 20,
          },
        ],
      ],
    ]);

    const result = ComputeScoreboard(
      new Map([[1, { id: 1, flags: [], division_id: 1, tag_ids: [] }]]),
      [
        { metadata: challenge1, expr },
        { metadata: challenge2, expr },
      ],
      solvesByChallenge,
      [],
    );

    const team1 = result.scoreboard.find((s) => s.team_id === 1)!;
    // challenge1: n=1, w=10 => 11
    // challenge2: n=1, w=20 => 21
    // total = 32
    expect(team1.score).toBe(32);

    // Each challenge has its own MemoizeScore, so display values use w=0
    expect(result.challenges.get(1)!.value).toBe(1); // n=1, w=0
    expect(result.challenges.get(2)!.value).toBe(1); // n=1, w=0
  });
});

describe(PartitionSolvesByChallenge, () => {
  const baseDate = new Date("2024-01-01T12:00:00Z");
  const earlierDate = new Date("2024-01-01T10:00:00Z");
  const laterDate = new Date("2024-01-01T14:00:00Z");

  const mockSolves: RawSolve[] = [
    {
      id: 1,
      challenge_id: 101,
      user_id: 1,
      team_id: 1,
      value: null,
      created_at: baseDate,
      updated_at: baseDate,
      hidden: false,
      weight: 0,
    },
    {
      id: 2,
      challenge_id: 101,
      user_id: 2,
      team_id: 2,
      value: null,
      created_at: laterDate,
      updated_at: laterDate,
      hidden: false,
      weight: 0,
    },
    {
      id: 3,
      challenge_id: 102,
      user_id: 1,
      team_id: 1,
      value: null,
      created_at: earlierDate,
      updated_at: earlierDate,
      hidden: true,
      weight: 0,
    },
    {
      id: 4,
      challenge_id: 102,
      user_id: 3,
      team_id: 3,
      value: null,
      created_at: baseDate,
      updated_at: baseDate,
      hidden: false,
      weight: 0,
    },
  ];

  it("should partition solves by challenge_id", () => {
    const result = PartitionSolvesByChallenge(mockSolves, {});

    expect(result.size).toBe(2);
    expect(result.has(101)).toBe(true);
    expect(result.has(102)).toBe(true);
    expect(result.get(101)).toHaveLength(2);
    expect(result.get(102)).toHaveLength(2);
  });

  it("should filter out solves created after the timestamp parameter", () => {
    const cutoffDate = new Date("2024-01-01T12:00:00Z");
    const result = PartitionSolvesByChallenge(mockSolves, {}, cutoffDate);

    const challenge101Solves = result.get(101) || [];
    const challenge102Solves = result.get(102) || [];

    // Only solves created before or at cutoff should be included
    expect(challenge101Solves).toHaveLength(1);
    expect(challenge102Solves).toHaveLength(2);
  });

  it("should preserve existing hidden property when true", () => {
    const result = PartitionSolvesByChallenge(mockSolves, {});

    const challenge102Solves = result.get(102) || [];
    const hiddenSolve = challenge102Solves.find((solve) => solve.id === 3);

    expect(hiddenSolve?.hidden).toBe(true);
  });

  it("should set hidden based on time range when original hidden is false", () => {
    const startTime = earlierDate.getTime() / 1000;
    const endTime = baseDate.getTime() / 1000;

    const result = PartitionSolvesByChallenge(mockSolves, {
      start_time_s: startTime,
      end_time_s: endTime,
    });

    const challenge101Solves = result.get(101) || [];
    const baseTimeSolve = challenge101Solves.find((solve) => solve.id === 1);
    const laterTimeSolve = challenge101Solves.find((solve) => solve.id === 2);

    expect(baseTimeSolve?.hidden).toBe(false); // Within time range
    expect(laterTimeSolve?.hidden).toBe(true); // Outside time range
  });

  it("should handle empty solve list", () => {
    const result = PartitionSolvesByChallenge([], {});

    expect(result.size).toBe(0);
  });

  it("should handle undefined time parameters", () => {
    const result = PartitionSolvesByChallenge(mockSolves, {
      start_time_s: undefined,
      end_time_s: undefined,
    });

    // All solves should be included and not hidden due to time constraints
    const challenge101Solves = result.get(101) || [];
    const challenge102Solves = result.get(102) || [];

    expect(challenge101Solves).toHaveLength(2);
    expect(challenge102Solves).toHaveLength(2);

    // Only the originally hidden solve should remain hidden
    const originallyHiddenSolve = challenge102Solves.find(
      (solve) => solve.id === 3,
    );
    const originallyVisibleSolve = challenge102Solves.find(
      (solve) => solve.id === 4,
    );

    expect(originallyHiddenSolve?.hidden).toBe(true);
    expect(originallyVisibleSolve?.hidden).toBe(false);
  });

  it("should handle only start_time_s parameter", () => {
    const startTime = baseDate.getTime() / 1000;

    const result = PartitionSolvesByChallenge(mockSolves, {
      start_time_s: startTime,
    });

    const challenge101Solves = result.get(101) || [];
    const earlyTimeSolve = challenge101Solves.find(
      (solve) => solve.created_at < baseDate && solve.id === 1,
    );
    const laterTimeSolve = challenge101Solves.find((solve) => solve.id === 2);

    // Solve before start time should be hidden
    if (earlyTimeSolve && earlyTimeSolve.created_at < baseDate) {
      expect(earlyTimeSolve.hidden).toBe(true);
    }
    // Solve after start time should not be hidden due to time
    expect(laterTimeSolve?.hidden).toBe(false);
  });

  it("should handle only end_time_s parameter", () => {
    const endTime = baseDate.getTime() / 1000;

    const result = PartitionSolvesByChallenge(mockSolves, {
      end_time_s: endTime,
    });

    const challenge101Solves = result.get(101) || [];
    const baseTimeSolve = challenge101Solves.find((solve) => solve.id === 1);
    const laterTimeSolve = challenge101Solves.find((solve) => solve.id === 2);

    expect(baseTimeSolve?.hidden).toBe(false); // At end time
    expect(laterTimeSolve?.hidden).toBe(true); // After end time
  });

  it("should combine timestamp filter with time range logic", () => {
    const cutoffDate = new Date("2024-01-01T13:00:00Z");
    const startTime = baseDate.getTime() / 1000;
    const endTime = laterDate.getTime() / 1000;

    const result = PartitionSolvesByChallenge(
      mockSolves,
      {
        start_time_s: startTime,
        end_time_s: endTime,
      },
      cutoffDate,
    );

    // Should exclude solve with id 2 (created at 14:00, after cutoff at 13:00)
    const challenge101Solves = result.get(101) || [];
    expect(challenge101Solves).toHaveLength(1);
    expect(challenge101Solves[0].id).toBe(1);
  });

  it("should preserve all original solve properties", () => {
    const result = PartitionSolvesByChallenge(mockSolves, {});

    const challenge101Solves = result.get(101) || [];
    const firstSolve = challenge101Solves[0];

    expect(firstSolve.id).toBe(mockSolves[0].id);
    expect(firstSolve.challenge_id).toBe(mockSolves[0].challenge_id);
    expect(firstSolve.user_id).toBe(mockSolves[0].user_id);
    expect(firstSolve.team_id).toBe(mockSolves[0].team_id);
    expect(firstSolve.value).toBe(mockSolves[0].value);
    expect(firstSolve.created_at).toBe(mockSolves[0].created_at);
    expect(firstSolve.updated_at).toBe(mockSolves[0].updated_at);
  });
});
