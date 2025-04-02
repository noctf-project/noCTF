import {
  Award,
  ChallengeMetadata,
  ChallengePrivateMetadataBase,
  ScoreboardEntry,
  Solve,
} from "@noctf/api/datatypes";
import { Expression } from "expr-eval";
import { DBSolve } from "../../dao/solve.ts";
import { partition } from "../../util/object.ts";
import { EvaluateScoringExpression } from "../score.ts";
import { Logger } from "../../types/primitives.ts";
import { MaxDate } from "../../util/date.ts";

export type ChallengeMetadataWithExpr = {
  expr: Expression;
  metadata: ChallengeMetadata;
};

type ChallengeSolvesResult = {
  score: number | null;
  solves: Solve[];
  last_valid_solve: Date;
};

export type ComputedChallengeScoreData = {
  challenge_id: number;
  score: number;
  solves: Solve[];
};

export type ChallengeSummary = {
  challenge_id: number;
  score: number;
  solve_count: number;
  bonuses: number[];
};

function ComputeScoresForChallenge(
  { metadata, expr }: ChallengeMetadataWithExpr,
  solves: DBSolve[],
  logger?: Logger,
): ChallengeSolvesResult {
  const {
    score: { params, bonus },
  } = metadata.private_metadata as ChallengePrivateMetadataBase;

  const [valid, hidden] = partition(
    solves,
    ({ team_flags, hidden }) => !(team_flags?.includes("hidden") || hidden),
  );
  try {
    const base = EvaluateScoringExpression(expr, params, valid.length);
    let last_solve = new Date(0);
    const rv: Solve[] = valid.map(({ team_id, created_at }, i) => {
      last_solve = created_at;
      return {
        team_id,
        challenge_id: metadata.id,
        bonus: bonus && i + 1,
        hidden: false,
        score: base + ((bonus && Math.round(bonus[i])) || 0),
        created_at,
      };
    });
    const rh: Solve[] = hidden.map(({ team_id, created_at }) => ({
      team_id,
      challenge_id: metadata.id,
      hidden: true,
      score: base,
      created_at,
    }));
    return {
      score: base,
      solves: rv.concat(rh),
      last_valid_solve: last_solve,
    };
  } catch (err) {
    if (logger)
      logger.warn(
        `Failed to calculate scores for challenge ${metadata.id}`,
        err,
      );
    return {
      score: null,
      solves: [],
      last_valid_solve: new Date(0),
    };
  }
}

export function ComputeScoreboard(
  challenges: ChallengeMetadataWithExpr[],
  solvesByChallenge: Record<number, DBSolve[]>,
  awards: Award[],
  logger?: Logger,
) {
  // score, followed by date of last solve for tiebreak purposes
  const teamScores: Map<number, Omit<ScoreboardEntry, "team_id">> = new Map();
  const computed = challenges.map((x) => {
    const result = ComputeScoresForChallenge(
      x,
      solvesByChallenge[x.metadata.id] || [],
      logger,
    );
    return [x.metadata.id, result] as [number, ChallengeSolvesResult];
  });
  const challengeScores = [];
  for (const [challenge_id, { score, solves, last_valid_solve }] of computed) {
    const challengeSolves = [];
    for (const solve of solves) {
      challengeSolves.push({
        team_id: solve.team_id,
        hidden: solve.hidden,
        bonus: solve.bonus,
        score: solve.score,
        created_at: solve.created_at,
        challenge_id: solve.challenge_id,
      });
      if (solve.hidden) continue;

      let team = teamScores.get(solve.team_id);
      if (!team) {
        team = {
          score: 0,
          updated_at: new Date(0),
          last_solve: new Date(0),
        };
        teamScores.set(solve.team_id, team);
      }
      team.score += solve.score;
      team.last_solve = MaxDate(solve.created_at, team.last_solve);
      team.updated_at = MaxDate(last_valid_solve, team.updated_at);
    }
    challengeScores.push({
      challenge_id,
      score: score || 0,
      solves: challengeSolves,
    });
  }

  for (const award of awards) {
    let team = teamScores.get(award.team_id);
    if (!team) {
      team = {
        score: 0,
        updated_at: new Date(0),
        last_solve: new Date(0),
      };
      teamScores.set(award.team_id, team);
    }
    team.score += award.value;
    team.updated_at = MaxDate(award.created_at, team.updated_at);
  }

  const scoreboard = Array.from(
    teamScores.entries().map(([team_id, teamScore]) => ({
      ...teamScore,
      team_id,
    })),
  );

  const challengeObj = challengeScores.reduce(
    (prev, cur) => {
      prev[cur.challenge_id] = cur;
      return prev;
    },
    {} as Record<number, ComputedChallengeScoreData>,
  );

  return {
    scoreboard: scoreboard.sort(
      (a, b) =>
        b.score - a.score || a.last_solve.getTime() - b.last_solve.getTime(),
    ),
    challenges: challengeObj,
  };
}

export const GetChangedTeamScores = (
  s1: ScoreboardEntry[],
  s2: ScoreboardEntry[],
) => {
  const map: Map<number, ScoreboardEntry> = new Map();
  const output: ScoreboardEntry[] = [];
  for (const entry of s1) {
    map.set(entry.team_id, entry);
  }
  for (const entry of s2) {
    const e2 = map.get(entry.team_id);
    if (entry.score !== e2?.score) {
      output.push(entry);
    }
  }
  return output;
};
