import { ScoringStrategy } from "@noctf/api/datatypes";

const STRATEGIES: Record<string, ScoringStrategy> = {
  static: {
    expr: "base",
    description: "Returns a static score. Takes in a singular [base] param.",
  },
  quadratic: {
    expr: "max(base, (((base - top) / (decay ^ 2)) * (ctx.n ^ 2)) + top)",
    description:
      "Based on CTFd's dynamic scoring formula. base is the minimum score, top is the" +
      "maximum score, and decay is the number of solves before the score becomes zero.",
  },
  exponential: {
    expr: "base + (top - base) / (1 + (max(0, ctx.n - 1)/k) ^ j)",
    description:
      "Based on the CCC CTF dynamic scoring formula. base is the minimum score, top is" +
      " the maximum score, k is the scaling factor and j is the exponent.",
  },
};

export class ScoreService {}
