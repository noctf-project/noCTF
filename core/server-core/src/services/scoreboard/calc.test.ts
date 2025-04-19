import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ComputeScoreboard,
  GetChangedTeamScores,
  MinimalScoreboardEntry,
} from "./calc.ts";
import {
  ChallengeMetadata,
  ChallengePrivateMetadataBase,
  ScoreboardEntry,
} from "@noctf/api/datatypes";
import { mockDeep } from "vitest-mock-extended";
import { Expression } from "expr-eval";
import { Timestamp } from "@noctf/schema";
import { EvaluateScoringExpression } from "../score.ts";
import { HistoryDataPoint } from "../../dao/score_history.ts";

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
        updated_at: new Date(1),
      },
    ];
    expect(GetChangedTeamScores(s1, s2)).toEqual([
      {
        team_id: 1,
        score: 10,
        updated_at: new Date(1),
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
    const result = ComputeScoreboard(new Map(), [], {}, []);
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
      {
        1: [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1) as unknown as Timestamp & Date, // fuck TS
            updated_at: new Date(1) as unknown as Timestamp & Date,
            team_id: 1,
            value: null,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 2,
            created_at: new Date(3) as unknown as Timestamp & Date, // fuck TS
            updated_at: new Date(3) as unknown as Timestamp & Date,
            team_id: 2,
            value: 100,
          },
        ],
      },
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
              },
              {
                bonus: undefined,
                created_at: new Date(3),
                hidden: false,
                challenge_id: 1,
                value: 100,
                team_id: 2,
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
      {
        1: [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1) as unknown as Timestamp & Date, // fuck TS
            updated_at: new Date(1) as unknown as Timestamp & Date,
            team_id: 1,
            value: null,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 2,
            created_at: new Date(2) as unknown as Timestamp & Date, // fuck TS
            updated_at: new Date(2) as unknown as Timestamp & Date,
            team_id: 3,
            value: null,
          },
          {
            challenge_id: 1,
            hidden: false,
            id: 2,
            created_at: new Date(3) as unknown as Timestamp & Date, // fuck TS
            updated_at: new Date(3) as unknown as Timestamp & Date,
            team_id: 2,
            value: null,
          },
        ],
      },
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
              },
              {
                bonus: undefined,
                created_at: new Date(2),
                hidden: false,
                challenge_id: 1,
                value: 1,
                team_id: 3,
              },
              {
                bonus: undefined,
                created_at: new Date(3),
                hidden: false,
                challenge_id: 1,
                value: 1,
                team_id: 2,
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
      {
        1: [
          {
            challenge_id: 1,
            hidden: false,
            id: 1,
            created_at: new Date(1) as unknown as Timestamp & Date,
            updated_at: new Date(1) as unknown as Timestamp & Date,
            team_id: 1,
            value: null,
          },
        ],
      },
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
              },
            ],
          },
        ],
      ]),
    });
  });
});
