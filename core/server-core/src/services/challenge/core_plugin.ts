import {
  ChallengeMetadata,
  ChallengePrivateMetadataBase,
  ChallengePublicMetadataBase,
  ChallengeSolveInputType,
} from "@noctf/api/datatypes";
import { ServiceCradle } from "../../index.ts";
import { ChallengePlugin, SolveData } from "./types.ts";
import pLimit from "p-limit";
import { ValidationError } from "../../errors.ts";
import { EvaluateScoringExpression } from "../score.ts";

const FILE_METADATA_LIMIT = 16;
const FILE_METADATA_LIMITER = pLimit(FILE_METADATA_LIMIT);

type CorePluginProps = Pick<
  ServiceCradle,
  "logger" | "fileService" | "scoreService"
>;

// TODO: encrypted flags
// TODO: expose flag config types to FE
const FLAG_STRATEGIES: Record<
  string,
  (
    spec: string,
    teamId: number,
    candidate: string,
  ) => {
    solved: boolean;
    comment?: string;
  }
> = {
  case_sensitive: (spec, _teamId, candidate) => ({
    solved: candidate === spec,
  }),
  case_insensitive: (spec, _teamId, candidate) => ({
    solved:
      candidate.localeCompare(spec, undefined, { sensitivity: "base" }) === 0,
  }),
  regex_sensitive: (spec, _teamId, candidate) => ({
    solved: !!candidate.match(spec),
  }),
  regex_insensitive: (spec, _teamId, candidate) => ({
    solved: !!candidate.match(new RegExp(spec, "i")),
  }),
};

export class CoreChallengePlugin implements ChallengePlugin {
  private readonly logger;
  private readonly scoreService;
  private readonly fileService;

  constructor({ logger, scoreService, fileService }: CorePluginProps) {
    this.logger = logger;
    this.scoreService = scoreService;
    this.fileService = fileService;
  }

  name() {
    return "core";
  }

  privateSchema() {
    return ChallengePrivateMetadataBase;
  }

  preSolve = async (
    c: ChallengeMetadata,
    teamId: number,
    data: string,
  ): Promise<SolveData | null> => {
    const m = c.private_metadata;
    switch (m.solve.source) {
      case "manual":
        if (m.solve.manual?.input_type === ChallengeSolveInputType.None)
          return null;
        return {
          status: "queued",
        };
      case "flag":
        for (const spec of m.solve.flag || []) {
          const strategy = FLAG_STRATEGIES[spec.strategy];
          if (!strategy) {
            this.logger.warn(
              { strategy: spec.strategy },
              "Challenge misconfigured: Flag strategy does not exist",
            );
            continue;
          }
          const result = strategy(spec.data, teamId, data);
          if (result.solved)
            return {
              status: "correct",
            };
        }
        return {
          status: "incorrect",
        };
      default:
        return null;
    }
  };

  render = async (
    m: ChallengePrivateMetadataBase,
  ): Promise<ChallengePublicMetadataBase> => {
    return {
      solve: {
        input_type:
          m.solve.source === "flag"
            ? ChallengeSolveInputType.Text
            : m.solve.source === "manual"
              ? m.solve.manual!.input_type
              : ChallengeSolveInputType.None,
      },
      files: await Promise.allSettled(
        Object.keys(m.files).map((filename) =>
          FILE_METADATA_LIMITER(() =>
            this.fileService.getMetadata(m.files[filename].id),
          ).then(({ hash, size, url }) => ({ filename, hash, size, url, is_attachment: m.files[filename].is_attachment })),
        ),
      ).then((p) =>
        p
          .map((m) => m.status === "fulfilled" && m.value)
          .filter((v): v is Exclude<typeof v, false> => !!v),
      ),
    };
  };

  validate = async (m: ChallengePrivateMetadataBase) => {
    try {
      const expr = await this.scoreService.getExpr(m.score.strategy);
      EvaluateScoringExpression(expr, m.score.params, 0);
    } catch (e) {
      throw new ValidationError(
        `Failed to evaluate scoring algorithm ${m.score.strategy}: ` +
          e.message,
      );
    }
    if (m.solve.source === "flag" && !m.solve.flag) {
      throw new ValidationError(
        "Solve configuration for source 'flag' is missing",
      );
    } else if (m.solve.source === "manual" && !m.solve.manual) {
      throw new ValidationError(
        "Solve configuration for source 'manual' is missing",
      );
    }

    const keys = Object.keys(m.files);
    const filePromises = await Promise.allSettled(
      keys.map((k) =>
        FILE_METADATA_LIMITER(() =>
          this.fileService.getMetadata(m.files[k].id),
        ),
      ),
    );
    const filesFailed = filePromises
      .map(({ status }, i) => status === "rejected" && keys[i])
      .filter((x) => x);
    if (filesFailed.length) {
      throw new ValidationError(
        `Failed to validate that files refs exist for: ${filesFailed.join(", ")}`,
      );
    }
  };
}
