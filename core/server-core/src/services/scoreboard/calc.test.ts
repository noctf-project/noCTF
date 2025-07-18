import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ChallengeMetadataWithExpr,
  ComputeFullGraph,
  ComputeScoreboard,
  GetChangedTeamScores,
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
import { EvaluateScoringExpression } from "../score.ts";
import { HistoryDataPoint } from "../../dao/score_history.ts";
import { MinimalTeamInfo } from "../../dao/team.ts";
import { RawSolve } from "../../dao/submission.ts";

vi.mock(import("../score.ts"));

describe(GetChangedTeamScores, () => {
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
    vi.mocked(
      EvaluateScoringExpression as (
        expr: Expression,
        params: Record<string, number>,
        n: number,
      ) => number,
    ).mockReturnValue(1);
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
          expr: mockDeep<Expression>(),
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
    vi.mocked(
      EvaluateScoringExpression as (
        expr: Expression,
        params: Record<string, number>,
        n: number,
      ) => number,
    ).mockReturnValue(1);
  });

  it("Calculates challenge scores, uses the last valid solve date as the date", () => {
    vi.mocked(
      EvaluateScoringExpression as (
        expr: Expression,
        params: Record<string, number>,
        n: number,
      ) => number,
    ).mockReturnValue(1);
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
          expr: mockDeep<Expression>(),
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
    vi.mocked(
      EvaluateScoringExpression as (
        expr: Expression,
        params: Record<string, number>,
        n: number,
      ) => number,
    ).mockReturnValue(1);
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
          expr: mockDeep<Expression>(),
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

  it("should compute score history with sample data and sample at the right interval", () => {
    vi.mocked(
      EvaluateScoringExpression as (
        expr: Expression,
        params: Record<string, number>,
        n: number,
        all: boolean,
      ) => [number, number][],
    ).mockReturnValue([
      [2, 500],
      [2, 400],
    ]);

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
        expr: mockDeep<Expression>(),
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

  it("should compute score history with sample data and sample at the right interval", () => {
    vi.mocked(
      EvaluateScoringExpression as (
        expr: Expression,
        params: Record<string, number>,
        n: number,
        all: boolean,
      ) => [number, number][],
    ).mockReturnValue([
      [2, 500],
      [2, 400],
    ]);

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
        expr: mockDeep<Expression>(),
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
    vi.mocked(
      EvaluateScoringExpression as (
        expr: Expression,
        params: Record<string, number>,
        n: number,
        all: boolean,
      ) => [number, number][],
    ).mockReturnValue([
      [2, 500],
      [2, 400],
    ]);

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
        expr: mockDeep<Expression>(),
      },
      {
        metadata: { ...challenge1, id: 2 },
        expr: mockDeep<Expression>(),
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
