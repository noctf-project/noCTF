import { afterEach, describe, expect, it, vi } from "vitest";
import { ComputeScoreboard, GetChangedTeamScores } from "./calc.ts";
import {
  ChallengeMetadata,
  ChallengePrivateMetadataBase,
  ScoreboardEntry,
} from "@noctf/api/datatypes";
import { mockDeep } from "vitest-mock-extended";
import { Expression } from "expr-eval";
import { Timestamp } from "@noctf/schema";
import { EvaluateScoringExpression } from "../score.ts";

vi.mock(import("../score.ts"));

describe(GetChangedTeamScores, () => {
  it("diff does not return any results if same everything", () => {
    const s1: ScoreboardEntry[] = [
      {
        team_id: 1,
        score: 1,
        last_solve: new Date(0),
        updated_at: new Date(0),
      },
      {
        team_id: 2,
        score: 2,
        last_solve: new Date(0),
        updated_at: new Date(0),
      },
    ];
    const s2: ScoreboardEntry[] = [
      {
        team_id: 1,
        score: 1,
        last_solve: new Date(0),
        updated_at: new Date(0),
      },
      {
        team_id: 2,
        score: 2,
        last_solve: new Date(0),
        updated_at: new Date(0),
      },
    ];
    expect(GetChangedTeamScores(s1, s2)).toEqual([]);
  });

  it("diff does not return any results if same score", () => {
    const s1: ScoreboardEntry[] = [
      {
        team_id: 1,
        score: 1,
        last_solve: new Date(0),
        updated_at: new Date(0),
      },
      {
        team_id: 2,
        score: 2,
        last_solve: new Date(0),
        updated_at: new Date(0),
      },
    ];
    const s2: ScoreboardEntry[] = [
      {
        team_id: 1,
        score: 1,
        last_solve: new Date(1),
        updated_at: new Date(1),
      },
      {
        team_id: 2,
        score: 2,
        last_solve: new Date(1),
        updated_at: new Date(1),
      },
    ];
    expect(GetChangedTeamScores(s1, s2)).toEqual([]);
  });

  it("diff does not care about missing results in second scoreboard", () => {
    const s1: ScoreboardEntry[] = [
      {
        team_id: 1,
        score: 1,
        last_solve: new Date(0),
        updated_at: new Date(0),
      },
      {
        team_id: 2,
        score: 2,
        last_solve: new Date(0),
        updated_at: new Date(0),
      },
    ];
    const s2: ScoreboardEntry[] = [];
    expect(GetChangedTeamScores(s1, s2)).toEqual([]);
  });

  it("diff cares if team score is added", () => {
    const s1: ScoreboardEntry[] = [
      {
        team_id: 1,
        score: 1,
        last_solve: new Date(0),
        updated_at: new Date(0),
      },
    ];
    const s2: ScoreboardEntry[] = [
      {
        team_id: 2,
        score: 2,
        last_solve: new Date(0),
        updated_at: new Date(0),
      },
    ];
    expect(GetChangedTeamScores(s1, s2)).toEqual([
      {
        team_id: 2,
        score: 2,
        last_solve: new Date(0),
        updated_at: new Date(0),
      },
    ]);
  });

  it("diff cares if team score is changed", () => {
    const s1: ScoreboardEntry[] = [
      {
        team_id: 1,
        score: 1,
        last_solve: new Date(0),
        updated_at: new Date(0),
      },
    ];
    const s2: ScoreboardEntry[] = [
      {
        team_id: 1,
        score: 10,
        last_solve: new Date(1),
        updated_at: new Date(1),
      },
    ];
    expect(GetChangedTeamScores(s1, s2)).toEqual([
      {
        team_id: 1,
        score: 10,
        last_solve: new Date(1),
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
    const result = ComputeScoreboard([], {}, []);
    expect(result).toEqual({
      scoreboard: [],
      challenges: {},
    });
  });

  it("Calculates challenge scores, uses the last valid solve date as the date", () => {
    vi.mocked(EvaluateScoringExpression).mockReturnValue(1 as any);
    const result = ComputeScoreboard(
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
            division_id: 1,
            hidden: false,
            id: 1,
            team_flags: [],
            created_at: new Date(1) as unknown as Timestamp & Date, // fuck TS
            team_id: 1,
          },
          {
            challenge_id: 1,
            division_id: 1,
            hidden: false,
            id: 2,
            team_flags: [],
            created_at: new Date(2) as unknown as Timestamp & Date, // fuck TS
            team_id: 3,
          },
          {
            challenge_id: 1,
            division_id: 1,
            hidden: false,
            id: 2,
            team_flags: [],
            created_at: new Date(3) as unknown as Timestamp & Date, // fuck TS
            team_id: 2,
          },
        ],
      },
      [],
    );
    expect(result).toEqual({
      scoreboard: [
        {
          score: 1,
          updated_at: new Date(3),
          last_solve: new Date(1),
          team_id: 1,
        },
        {
          score: 1,
          updated_at: new Date(3),
          last_solve: new Date(2),
          team_id: 3,
        },
        {
          score: 1,
          updated_at: new Date(3),
          last_solve: new Date(3),
          team_id: 2,
        },
      ],
      challenges: {
        "1": {
          challenge_id: 1,
          score: 1,
          solves: [
            {
              bonus: undefined,
              created_at: new Date(1),
              hidden: false,
              challenge_id: 1,
              score: 1,
              team_id: 1,
            },
            {
              bonus: undefined,
              created_at: new Date(2),
              hidden: false,
              challenge_id: 1,
              score: 1,
              team_id: 3,
            },
            {
              bonus: undefined,
              created_at: new Date(3),
              hidden: false,
              challenge_id: 1,
              score: 1,
              team_id: 2,
            },
          ],
        },
      },
    });
  });

  it("Calculates challenge scores and adds awards to date", () => {
    vi.mocked(EvaluateScoringExpression).mockReturnValue(1 as any);
    const result = ComputeScoreboard(
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
            division_id: 1,
            hidden: false,
            id: 1,
            team_flags: [],
            created_at: new Date(1) as any, // fuck TS
            team_id: 1,
          },
        ],
      },
      [
        {
          created_at: new Date(2) as any, // fuck TS
          id: 1 as any, // fuck TS
          team_id: 1,
          title: "test",
          value: 1,
        },
        {
          created_at: new Date(3) as any, // fuck TS
          id: 2 as any, // fuck TS
          team_id: 2,
          title: "test",
          value: 3,
        },
      ],
    );
    expect(result).toEqual({
      scoreboard: [
        {
          score: 3,
          last_solve: new Date(0),
          updated_at: new Date(3),
          team_id: 2,
        },
        {
          score: 2,
          last_solve: new Date(1),
          updated_at: new Date(2),
          team_id: 1,
        },
      ],
      challenges: {
        "1": {
          challenge_id: 1,
          score: 1,
          solves: [
            {
              bonus: undefined,
              created_at: new Date(1),
              hidden: false,
              challenge_id: 1,
              score: 1,
              team_id: 1,
            },
          ],
        },
      },
    });
  });
});
