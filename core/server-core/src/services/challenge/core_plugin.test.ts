import { describe, expect, it } from "vitest";
import { CoreChallengePlugin } from "./core_plugin.ts";
import { mockDeep } from "vitest-mock-extended";
import { Logger } from "../../types/primitives.ts";
import { ScoreService } from "../score.ts";
import { FileService } from "../file.ts";
import {
  Challenge,
  ChallengeMetadata,
  ChallengeSolveStatus,
} from "@noctf/api/datatypes";

describe(CoreChallengePlugin, () => {
  const logger = mockDeep<Logger>();
  const scoreService = mockDeep<ScoreService>();
  const fileService = mockDeep<FileService>();

  const service = new CoreChallengePlugin({
    logger,
    scoreService,
    fileService,
  });

  it("preSolve returns null if strategy not found", async () => {
    const result = await service.preSolve(
      {
        private_metadata: {
          solve: {
            source: "unknown",
          },
        },
      } as unknown as Challenge,
      1,
      "test",
    );
    expect(result).toBe(null);
  });

  it("preSolve queues manual submissions", async () => {
    const result = await service.preSolve(
      {
        private_metadata: {
          solve: {
            source: "manual",
          },
        },
      } as unknown as Challenge,
      1,
      "test",
    );
    expect(result).toEqual({
      status: ChallengeSolveStatus.Queued,
    });
  });

  it("preSolve validates no flags", async () => {
    const metadata = {
      private_metadata: {
        solve: {
          source: "flag",
          flag: [] as { data: string; strategy: string }[],
        },
      },
    } as Partial<ChallengeMetadata> as ChallengeMetadata;
    expect(await service.preSolve(metadata, 1, "test")).toEqual({
      status: ChallengeSolveStatus.Incorrect,
    });
  });

  it("preSolve validates case-sensitive flags", async () => {
    const metadata = {
      private_metadata: {
        solve: {
          source: "flag",
          flag: [
            {
              strategy: "case_sensitive",
              data: "CTF{isthebest}",
            },
          ],
        },
      },
    } as Partial<ChallengeMetadata> as ChallengeMetadata;
    expect(await service.preSolve(metadata, 1, "test")).toEqual({
      status: ChallengeSolveStatus.Incorrect,
    });
    expect(await service.preSolve(metadata, 1, "ctf{isthebest}")).toEqual({
      status: ChallengeSolveStatus.Incorrect,
    });
    expect(await service.preSolve(metadata, 1, "CTF{isthebest}")).toEqual({
      status: ChallengeSolveStatus.Correct,
    });
  });

  it("preSolve validates case-insensitive flags", async () => {
    const metadata = {
      private_metadata: {
        solve: {
          source: "flag",
          flag: [
            {
              strategy: "case_insensitive",
              data: "CTF{isthebest}",
            },
          ],
        },
      },
    } as Partial<ChallengeMetadata> as ChallengeMetadata;
    expect(await service.preSolve(metadata, 1, "test")).toEqual({
      status: ChallengeSolveStatus.Incorrect,
    });
    expect(await service.preSolve(metadata, 1, "ctf{isthebest}")).toEqual({
      status: ChallengeSolveStatus.Correct,
    });
    expect(await service.preSolve(metadata, 1, "CTF{isthebest}")).toEqual({
      status: ChallengeSolveStatus.Correct,
    });
  });

  it("preSolve validates regex_sensitive flags", async () => {
    const metadata = {
      private_metadata: {
        solve: {
          source: "flag",
          flag: [
            {
              strategy: "regex_sensitive",
              data: "^hello.*$",
            },
          ],
        },
      },
    } as Partial<ChallengeMetadata> as ChallengeMetadata;
    expect(await service.preSolve(metadata, 1, "test")).toEqual({
      status: ChallengeSolveStatus.Incorrect,
    });
    expect(await service.preSolve(metadata, 1, "nohello")).toEqual({
      status: ChallengeSolveStatus.Incorrect,
    });
    expect(await service.preSolve(metadata, 1, "helloworld")).toEqual({
      status: ChallengeSolveStatus.Correct,
    });
  });

  it("preSolve validates regex_insensitive flags", async () => {
    const metadata = {
      private_metadata: {
        solve: {
          source: "flag",
          flag: [
            {
              strategy: "regex_insensitive",
              data: "^hello.*$",
            },
          ],
        },
      },
    } as Partial<ChallengeMetadata> as ChallengeMetadata;
    expect(await service.preSolve(metadata, 1, "test")).toEqual({
      status: ChallengeSolveStatus.Incorrect,
    });
    expect(await service.preSolve(metadata, 1, "nohello")).toEqual({
      status: ChallengeSolveStatus.Incorrect,
    });
    expect(await service.preSolve(metadata, 1, "HeLlOWoRlD")).toEqual({
      status: ChallengeSolveStatus.Correct,
    });
  });

  // TODO: tests for schema validation
});
