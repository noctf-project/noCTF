import {
  Award,
  ChallengeMetadata,
  ChallengePrivateMetadataBase,
  ScoreboardEntry,
  Solve,
} from "@noctf/api/datatypes";
import { Expression } from "expr-eval";
import { partition } from "../../util/object.ts";
import { MaxDate } from "../../util/date.ts";
import { MinimalTeamInfo } from "../../dao/team.ts";
import { RawSolve } from "../../dao/submission.ts";
import { HistoryDataPoint } from "../../dao/score_history.ts";
import { IsTimeBetweenSeconds } from "../../util/time.ts";
import { topK } from "../../util/arrays.ts";

export type ChallengeMetadataWithExpr = {
  expr: Expression;
  metadata: ChallengeMetadata;
};

type ChallengeSolvesResult = {
  value: number | null;
  solves: Solve[];
  last_event: Date;
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

export type MinimalScoreboardEntry = Pick<
  ScoreboardEntry,
  "team_id" | "score" | "updated_at" | "last_solve" | "hidden"
>;

type SubContext = { n: number; w: number };

// This function caches a single score since in most cases the score doesn't really change.
function MemoizeScore(
  expr: Expression,
  params: ChallengePrivateMetadataBase["score"]["params"],
) {
  const cache = new Map<string, number>();
  const ctx: SubContext = { n: 0, w: 0 };
  let lastN = -1;
  let lastW = -1;
  let lastVal: number | undefined;
  const simplified = expr.simplify(params);

  return (n: number, w: number) => {
    if (n === lastN && w === lastW && lastVal !== undefined) return lastVal;
    lastN = n;
    lastW = w;
    const key = `${n}:${w}`;
    lastVal = cache.get(key);
    if (lastVal !== undefined) return lastVal;

    ctx.n = n;
    ctx.w = w;
    lastVal = Math.round(simplified.evaluate({ ctx }));
    cache.set(key, lastVal);
    return lastVal;
  };
}
function ComputeScoresForChallenge(
  { metadata, expr }: ChallengeMetadataWithExpr,
  teams: Map<number, MinimalTeamInfo>,
  solves: RawSolve[],
): ChallengeSolvesResult {
  const {
    score: { params, bonus },
  } = metadata.private_metadata as ChallengePrivateMetadataBase;

  const [valid, hidden] = partition(
    solves,
    ({ team_id, hidden }) =>
      !(teams.get(team_id)?.flags.includes("hidden") || hidden),
  );

  const n = valid.filter(({ value }) => value === null).length;
  const memo = MemoizeScore(expr, params);

  let last_event = new Date(0);

  const withBase = valid.map((s) => {
    last_event = MaxDate(last_event, s.updated_at);
    return {
      ...s,
      created_at_ms: s.created_at.getTime(),
      baseScore: s.value !== null ? s.value : memo(n, s.weight),
    };
  });

  const bonusMap = new Map<number, number>();
  if (bonus && bonus.length > 0) {
    const eligible = withBase.filter((s) => s.value === null);
    const topEligible = topK(
      eligible,
      bonus.length,
      (a, b) => b.baseScore - a.baseScore || a.created_at_ms - b.created_at_ms,
    );

    topEligible.forEach((item, rank) => {
      if (bonus[rank] !== undefined) {
        bonusMap.set(item.team_id, bonus[rank]);
      }
    });
  }

  const rv: Solve[] = withBase.map(
    ({ team_id, user_id, created_at, baseScore, value }) => {
      const b = value !== null ? undefined : bonusMap.get(team_id);
      return {
        team_id,
        user_id,
        challenge_id: metadata.id,
        bonus: b,
        hidden: false,
        value: baseScore + ((b && Math.round(b)) || 0),
        created_at,
      };
    },
  );

  const rh: Solve[] = hidden.map(
    ({ team_id, user_id, created_at, updated_at, weight }) => {
      last_event = MaxDate(last_event, updated_at);
      return {
        team_id,
        user_id,
        challenge_id: metadata.id,
        hidden: true,
        value: memo(n, weight),
        created_at,
      };
    },
  );

  return {
    value: memo(n, 0), // by default, w is zero
    solves: rv.concat(rh),
    last_event: MaxDate(last_event, metadata.updated_at),
  };
}

function ComputeScoreStreamForChallenge(
  { metadata, expr }: ChallengeMetadataWithExpr,
  teams: Map<number, MinimalTeamInfo>,
  solves: RawSolve[],
) {
  const {
    score: { params, bonus },
  } = metadata.private_metadata as ChallengePrivateMetadataBase;

  const [valid] = partition(
    solves,
    ({ team_id, hidden }) =>
      !(teams.get(team_id)?.flags.includes("hidden") || hidden),
  );

  const memo = MemoizeScore(expr, params);
  const stream: {
    team_id: number;
    delta: number;
    updated_at: Date;
    updated_at_ms: number;
  }[] = [];
  const teamScores = new Map<number, { score: number; w: number }>();
  const distinctWeights = new Set<number>();
  let bonusIdx = 0;
  let n = 0;
  valid.forEach(({ team_id, created_at, value, weight }) => {
    const updated_at_ms = created_at.getTime();
    const b = value !== null ? undefined : bonus?.[bonusIdx++];
    if (value === null) {
      n++;
      // Check if any distinct weight produces a non-zero delta
      let anyChanged = false;
      for (const w of distinctWeights) {
        if (memo(n, w) !== memo(n - 1, w)) {
          anyChanged = true;
          break;
        }
      }

      if (anyChanged) {
        // n changed: emit retroactive score adjustments for previous solvers whose score changed
        for (const [tid, state] of teamScores) {
          const updated = memo(n, state.w);
          const delta = updated - state.score;
          if (delta !== 0) {
            stream.push({
              team_id: tid,
              delta,
              updated_at: created_at,
              updated_at_ms,
            });
            state.score = updated;
          }
        }
      }
    }
    const score =
      value !== null ? value : memo(n, weight) + ((b && Math.round(b)) || 0);
    stream.push({
      team_id,
      delta: score,
      updated_at: created_at,
      updated_at_ms,
    });
    // Only track dynamic solves for future retroactive adjustments
    if (value === null) {
      distinctWeights.add(weight);
      teamScores.set(team_id, { score: memo(n, weight), w: weight });
    }
  });
  return stream;
}

export function ComputeFullGraph(
  teams: Map<number, MinimalTeamInfo>,
  challenges: ChallengeMetadataWithExpr[],
  solvesByChallenge: Map<number, RawSolve[]>,
  awards: Award[],
  sampleRateMs = 1000,
): HistoryDataPoint[] {
  const stream = challenges.flatMap((x) =>
    ComputeScoreStreamForChallenge(
      x,
      teams,
      solvesByChallenge.get(x.metadata.id) || [],
    ),
  );
  for (const { team_id, value, created_at } of awards) {
    const hidden = teams.get(team_id)?.flags.includes("hidden");
    if (hidden) continue;
    stream.push({
      team_id,
      delta: value,
      updated_at: created_at,
      updated_at_ms: created_at.getTime(),
    });
  }
  stream.sort(
    (a, b) => a.team_id - b.team_id || a.updated_at_ms - b.updated_at_ms,
  );
  const scores = new Map<number, number>();
  const points: HistoryDataPoint[] = [];
  let lastUpdated: number | undefined;
  for (const { team_id, delta, updated_at_ms } of stream) {
    const score = (scores.get(team_id) || 0) + delta;
    scores.set(team_id, score);
    const last = points[points.length - 1];
    const sampled = Math.floor(updated_at_ms / sampleRateMs) * sampleRateMs;
    if (last && last.team_id === team_id && lastUpdated === sampled) {
      last.score = score;
    } else {
      points.push({ score, team_id, updated_at: new Date(sampled) });
      lastUpdated = sampled;
    }
  }
  return points;
}

export function ComputeScoreboard(
  teams: Map<number, MinimalTeamInfo>,
  challenges: ChallengeMetadataWithExpr[],
  solvesByChallenge: Map<number, RawSolve[]>,
  awards: Award[],
): {
  scoreboard: ScoreboardEntry[];
  challenges: Map<number, ComputedChallengeScoreData>;
  last_event: Date;
} {
  let last_event = new Date(0);
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
        solves: [] as Solve[],
        awards: [] as Award[],
      },
    ]),
  );
  const computed = challenges.map((x) => {
    const result = ComputeScoresForChallenge(
      x,
      teams,
      solvesByChallenge.get(x.metadata.id) || [],
    );
    return [x.metadata.id, result] as [number, ChallengeSolvesResult];
  });
  const challengeScores: ComputedChallengeScoreData[] = [];
  for (const [
    challenge_id,
    { value, solves, last_event: cLastEvent },
  ] of computed) {
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
        : MaxDate(cLastEvent, team.updated_at);
    }
    last_event = MaxDate(cLastEvent, last_event);
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
    last_event = MaxDate(team.updated_at, last_event);
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
      b.score - a.score ||
      a.last_solve.getTime() - b.last_solve.getTime() ||
      a.team_id - b.team_id, // this should never happen but used to preserve stability
  );
  sorted.forEach((x, i) => {
    x.rank =
      i > 0 &&
      sorted[i - 1].score === x.score &&
      sorted[i - 1].last_solve.getTime() === x.last_solve.getTime()
        ? i
        : i + 1;
    x.hidden =
      x.hidden ||
      (x.score === 0 && !x.awards.length && x.solves.every((s) => s.hidden));
  });

  return {
    scoreboard: sorted,
    challenges: challengesMap,
    last_event,
  };
}

export const GetMinimalScoreboard = (
  scoreboard: ScoreboardEntry[],
): HistoryDataPoint[] =>
  scoreboard.map((s) => ({
    score: s.score,
    updated_at: s.updated_at,
    team_id: s.team_id,
  }));

export const GetChangedTeamScores = (
  s1: HistoryDataPoint[],
  s2: HistoryDataPoint[],
  sampleRateMs = 1000,
) => {
  const map: Map<number, HistoryDataPoint> = new Map();
  const output: HistoryDataPoint[] = [];
  for (const entry of s1) {
    map.set(entry.team_id, entry);
  }
  for (const entry of s2) {
    const e2 = map.get(entry.team_id);
    map.delete(entry.team_id);
    if (entry.score !== e2?.score) {
      output.push({
        ...entry,
        updated_at: new Date(
          Math.floor(entry.updated_at.getTime() / sampleRateMs) * sampleRateMs,
        ),
      });
    }
  }
  for (const [_v, v] of map) {
    output.push({
      ...v,
      updated_at: new Date(0),
      score: 0,
    });
  }
  return output;
};

export const PartitionSolvesByChallenge = (
  solveList: RawSolve[],
  time: { start_time_s?: number; end_time_s?: number },
  timestamp?: Date,
) => {
  const solvesByChallenge = new Map<number, RawSolve[]>();
  solveList.forEach((x) => {
    if (timestamp && x.created_at > timestamp) return;
    let solves = solvesByChallenge.get(x.challenge_id);
    if (!solves) {
      solves = [];
      solvesByChallenge.set(x.challenge_id, solves);
    }
    solves.push({
      ...x,
      hidden:
        x.hidden ||
        !IsTimeBetweenSeconds(x.created_at, time.start_time_s, time.end_time_s),
    });
  });
  return solvesByChallenge;
};
