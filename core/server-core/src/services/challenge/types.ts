import { Challenge, ChallengeMetadata } from "@noctf/api/datatypes";
import { ChallengeSolveStatus } from "@noctf/api/enums";
import { TSchema } from "@sinclair/typebox";

export type SolveData = {
  status: ChallengeSolveStatus;
  comment?: string;
};

export interface ChallengePlugin {
  name: () => string;
  privateSchema: () => TSchema;
  render: (m: Challenge["private_metadata"]) => Promise<object>;
  validate: (m: Challenge["private_metadata"]) => Promise<void>;
  preSolve: (
    m: ChallengeMetadata,
    teamId: number,
    data: string,
  ) => Promise<SolveData | null>;
}
