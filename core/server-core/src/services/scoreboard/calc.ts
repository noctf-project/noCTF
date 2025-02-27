import {
  ChallengeMetadata,
  ChallengePrivateMetadataBase,
  ScoreboardEntry,
  Solve,
} from "@noctf/api/datatypes";
import { Expression } from "expr-eval";
import { DBSolve } from "../../dao/solve.ts";
import { deepEqual, partition } from "../../util/object.ts";
import { EvaluateScoringExpression } from "../score.ts";
import { Logger } from "../../types/primitives.ts";

export type ChallengeMetadataWithExpr = {
  expr: Expression;
  metadata: ChallengeMetadata;
};

export type ChallengeSolvesResult = {
  score: number | null;
  solves: Solve[];
  last_valid_solve: Date;
};

export type ChallengeScore = {
  challenge_id: number;
  score: number;
  solves: {
    team_id: number;
    score: number;
    bonus?: number;
    hidden: boolean;
    created_at: Date;
  }[];
};

export function ComputeScoreboardByDivision(
  challenges: ChallengeMetadataWithExpr[],
  solvesByChallenge: Record<number, DBSolve[]>,
  logger?: Logger,
) {
  // score, followed by date of last solve for tiebreak purposes
  const teamScores: Map<number, { score: number; time: Date }> = new Map();
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
      });
      if (solve.hidden) continue;

      let team = teamScores.get(solve.team_id);
      if (!team) {
        team = {
          score: 0,
          time: new Date(0),
        };
        teamScores.set(solve.team_id, team);
      }
      team.score += solve.score;
      team.time = last_valid_solve > team.time ? last_valid_solve : team.time;
    }
    challengeScores.push({
      challenge_id,
      score: score || 0,
      solves: challengeSolves,
    });
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
    {} as Record<number, ChallengeScore>,
  );

  return {
    scoreboard: scoreboard.sort(
      (a, b) => a.score - b.score || a.time.getTime() - b.time.getTime(),
    ),
    challenges: challengeObj,
  };
}

export function ComputeScoresForChallenge(
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
    let last_valid_solve = new Date(0);
    const rv: Solve[] = valid.map(({ team_id, created_at }, i) => {
      last_valid_solve = created_at;
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
      last_valid_solve,
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
    if (!deepEqual(entry, map.get(entry.team_id))) {
      output.push(entry);
    }
  }
  return output;
};
