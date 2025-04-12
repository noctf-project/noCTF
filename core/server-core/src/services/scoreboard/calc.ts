import {
  Award,
  ChallengeMetadata,
  ChallengePrivateMetadataBase,
  ScoreboardEntry,
  Solve,
} from "@noctf/api/datatypes";
import { Expression } from "expr-eval";
import { partition } from "../../util/object.ts";
import { EvaluateScoringExpression } from "../score.ts";
import { Logger } from "../../types/primitives.ts";
import { MaxDate } from "../../util/date.ts";
import { MinimalTeamInfo } from "../../dao/team.ts";
import { RawSolve } from "../../dao/submission.ts";

export type ChallengeMetadataWithExpr = {
  expr: Expression;
  metadata: ChallengeMetadata;
};

type ChallengeSolvesResult = {
  value: number | null;
  solves: Solve[];
  last_updated: Date;
};

export type ComputedChallengeScoreData = {
  challenge_id: number;
  value: number;
  solves: Solve[];
};

export type ChallengeSummary = {
  challenge_id: number;
  value: number;
  solve_count: number;
  bonuses: number[];
};

function ComputeScoresForChallenge(
  { metadata, expr }: ChallengeMetadataWithExpr,
  teams: Map<number, MinimalTeamInfo>,
  solves: RawSolve[],
  logger?: Logger,
): ChallengeSolvesResult {
  const {
    score: { params, bonus },
  } = metadata.private_metadata as ChallengePrivateMetadataBase;

  const [valid, hidden] = partition(
    solves,
    ({ team_id, hidden }) =>
      !(teams.get(team_id)?.flags.includes("hidden") || hidden),
  );
  try {
    const base = EvaluateScoringExpression(
      expr,
      params,
      valid.filter(({ value }) => value === null).length,
    );
    let last_updated = new Date(0);
    let bonusIdx = 0;
    const rv: Solve[] = valid.map(
      ({ team_id, created_at, updated_at, value }) => {
        last_updated = MaxDate(last_updated, updated_at);
        const b = value !== null ? undefined : bonus?.[bonusIdx++];
        return {
          team_id,
          challenge_id: metadata.id,
          bonus: b,
          hidden: false,
          value: value !== null ? value : base + ((b && Math.round(b)) || 0),
          created_at,
        };
      },
    );
    const rh: Solve[] = hidden.map(({ team_id, created_at, updated_at }) => {
      last_updated = MaxDate(last_updated, updated_at);

      return {
        team_id,
        challenge_id: metadata.id,
        hidden: true,
        value: base,
        created_at,
      };
    });
    return {
      value: base,
      solves: rv.concat(rh),
      last_updated,
    };
  } catch (err) {
    if (logger)
      logger.warn(
        `Failed to calculate scores for challenge ${metadata.id}`,
        err,
      );
    return {
      value: null,
      solves: [],
      last_updated: new Date(0),
    };
  }
}

export function ComputeScoreboard(
  teams: Map<number, MinimalTeamInfo>,
  challenges: ChallengeMetadataWithExpr[],
  solvesByChallenge: Record<number, RawSolve[]>,
  awards: Award[],
  logger?: Logger,
): {
  scoreboard: ScoreboardEntry[];
  challenges: Map<number, ComputedChallengeScoreData>;
} {
  // score, followed by date of last solve for tiebreak purposes
  const teamScores: Map<number, ScoreboardEntry> = new Map(
    teams.values().map(({ id, flags, tag_ids }) => [
      id,
      {
        score: 0,
        team_id: id,
        rank: 0,
        tag_ids: tag_ids.sort(),
        updated_at: new Date(0),
        last_solve: new Date(0),
        hidden: flags.includes("hidden"),
        solves: [],
        awards: [],
      },
    ]),
  );
  const computed = challenges.map((x) => {
    const result = ComputeScoresForChallenge(
      x,
      teams,
      solvesByChallenge[x.metadata.id] || [],
      logger,
    );
    return [x.metadata.id, result] as [number, ChallengeSolvesResult];
  });
  const challengeScores: ComputedChallengeScoreData[] = [];
  for (const [challenge_id, { value, solves, last_updated }] of computed) {
    const challengeSolves: Solve[] = [];
    for (const solve of solves) {
      challengeSolves.push(solve);
      const team = teamScores.get(solve.team_id);
      if (!team) {
        continue;
      }
      team.score += solve.hidden ? 0 : solve.value;
      team.solves.push(solve);
      team.last_solve = solve.hidden
        ? team.last_solve
        : MaxDate(solve.created_at, team.last_solve);
      team.updated_at = solve.hidden
        ? team.updated_at
        : MaxDate(last_updated, team.updated_at);
    }
    challengeScores.push({
      challenge_id,
      value: value || 0,
      solves: challengeSolves,
    });
  }

  for (const award of awards) {
    const team = teamScores.get(award.team_id);
    if (!team) {
      continue;
    }
    team.awards.push(award);
    team.score += award.value;
    team.updated_at = MaxDate(award.created_at, team.updated_at);
  }

  const scoreboard = Array.from(
    teamScores.entries().map(([team_id, teamScore]) => ({
      ...teamScore,
      team_id,
    })),
  );

  const challengesMap = challengeScores.reduce((prev, cur) => {
    prev.set(cur.challenge_id, cur);
    return prev;
  }, new Map<number, ComputedChallengeScoreData>());

  const sorted = scoreboard.sort(
    (a, b) =>
      b.score - a.score || a.last_solve.getTime() - b.last_solve.getTime(),
  );
  sorted.forEach(
    (x, i) =>
      (x.rank =
        i > 0 &&
        sorted[i - 1].score === x.score &&
        sorted[i - 1].last_solve === x.last_solve
          ? i
          : i + 1),
  );
  return {
    scoreboard: sorted,
    challenges: challengesMap,
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
