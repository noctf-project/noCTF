import { describe, expect, it } from "vitest";
import type { Policy } from "./policy.ts";
import { Evaluate, EvaluatePrefix, PreprocessPermissions } from "./policy.ts";

describe(Evaluate, () => {
  it("Evaluates single scalar policies", () => {
    const permissions = [
      "admin.user.*",
      "admin.challenges.*",
      "!admin.user.update",
    ];

    expect(Evaluate(["admin.user"], permissions)).toBe(true);
    expect(Evaluate(["admin.user.update"], permissions)).toBe(false);
    expect(Evaluate(["admin.config"], permissions)).toBe(false);
    expect(Evaluate(["admin.challenges"], permissions)).toBe(true);
    expect(Evaluate(["admin.challenges"], ["!*", "admin.challenges.*"])).toBe(
      false,
    );
    expect(Evaluate(["user.get"], permissions)).toBe(false);
  });

  it("Evaluates multi scalar policies", () => {
    const permissions = [
      "*",
      "admin.user.*",
      "admin.challenges.*",
      "!admin.user.update",
    ];

    expect(
      Evaluate(["OR", "admin.challenges", "admin.user"], permissions),
    ).toBe(true);
    expect(
      Evaluate(["AND", "admin.challenges", "admin.user"], permissions),
    ).toBe(true);
    expect(
      Evaluate(
        ["OR", "admin.user.update", "admin.challenges.get"],
        permissions,
      ),
    ).toBe(true);
    expect(
      Evaluate(
        ["AND", "admin.user.update", "admin.challenges.get"],
        permissions,
      ),
    ).toBe(false);
  });

  it("Evaluates nested policies", () => {
    const permissions = ["admin.user.*"];

    expect(
      Evaluate(
        [
          "OR",
          ["OR", "admin.challenges", "admin.user"],
          ["AND", "admin.challenges", "admin.user"],
        ],
        permissions,
      ),
    ).toBe(true);

    expect(
      Evaluate(
        [
          "AND",
          ["OR", "admin.challenges", "admin.user"],
          ["AND", "admin.challenges", "admin.user"],
        ],
        permissions,
      ),
    ).toBe(false);
  });

  it("Fails to evaluate deeply nested policies according to TTL", () => {
    const permissions = ["admin.user.*"];

    expect(
      Evaluate(
        [
          "OR",
          ["OR", ["OR", ["OR", "admin.challenges", "admin.user"]]],
          ["AND", "admin.challenges", "admin.user"],
        ],
        permissions,
        2,
      ),
    ).toBe(false);

    expect(
      Evaluate(
        [
          "OR",
          ["OR", ["OR", ["OR", "admin.challenges", "admin.user"]]],
          ["AND", "admin.challenges", "admin.user"],
        ],
        permissions,
        64,
      ),
    ).toBe(true);
  });

  it("Fails to evaluate incorrect policies", () => {
    const permissions = ["admin.user", "!admin", "admin.challenges"];

    expect(() =>
      Evaluate(["NO", "admin.user"] as unknown as Policy, permissions),
    ).toThrowError("Invalid policy expression");
  });
});

describe(PreprocessPermissions, () => {
  it("should handle the original example correctly", () => {
    const input = [
      "!admin.team.*",
      "admin.team.get",
      "admin.user.*",
      "!admin.user.update",
    ];
    const result = PreprocessPermissions(input);

    expect(result).toEqual([
      "!admin.team.*",
      "!admin.user.update",
      "admin.user.*",
    ]);
  });

  it("should remove exact matches", () => {
    const input = ["!admin.get", "admin.get", "admin.post"];
    const result = PreprocessPermissions(input);

    expect(result).toEqual(["!admin.get", "admin.post"]);
  });

  it("should handle global wildcard correctly", () => {
    const input = ["!*", "admin.get", "user.post", "system.read"];
    const result = PreprocessPermissions(input);

    expect(result).toEqual(["!*"]);
  });

  it("should handle multiple wildcards", () => {
    const input = [
      "!admin.*",
      "!user.*",
      "admin.get",
      "user.post",
      "system.read",
    ];
    const result = PreprocessPermissions(input);

    expect(result).toEqual(["!admin.*", "!user.*", "system.read"]);
  });

  it("should maintain correct ordering", () => {
    const input = ["zz.read", "admin.get", "!admin.*", "aa.write"];
    const result = PreprocessPermissions(input);

    expect(result).toEqual(["!admin.*", "aa.write", "zz.read"]);
  });

  it("should handle empty input", () => {
    const input: string[] = [];
    const result = PreprocessPermissions(input);

    expect(result).toEqual([]);
  });

  it("should handle only positive permissions", () => {
    const input = ["admin.get", "user.post", "system.read"];
    const result = PreprocessPermissions(input);

    expect(result).toEqual(["admin.get", "system.read", "user.post"]);
  });

  it("should handle only negative permissions", () => {
    const input = ["!admin.get", "!user.post", "!system.read"];
    const result = PreprocessPermissions(input);

    expect(result).toEqual(["!admin.get", "!system.read", "!user.post"]);
  });

  it("should handle complex wildcard patterns", () => {
    const input = [
      "!admin.team.*",
      "admin.team.get",
      "admin.team.post",
      "admin.user.get",
      "admin.user.post",
      "!admin.user.delete",
    ];
    const result = PreprocessPermissions(input);

    expect(result).toEqual([
      "!admin.team.*",
      "!admin.user.delete",
      "admin.user.get",
      "admin.user.post",
    ]);
  });

  it("should handle nested wildcard patterns", () => {
    const input = [
      "!admin.*",
      "admin.team.get",
      "admin.user.get",
      "!admin.user.*",
      "admin.user.post",
    ];
    const result = PreprocessPermissions(input);

    expect(result).toEqual(["!admin.*", "!admin.user.*"]);
  });

  it("should handle duplicate permissions", () => {
    const input = ["!admin.get", "admin.get", "admin.get", "!admin.get"];
    const result = PreprocessPermissions(input);

    expect(result).toEqual(["!admin.get", "!admin.get"]);
  });

  it("should handle permissions with dots but no wildcards", () => {
    const input = [
      "!admin.team.specific",
      "admin.team.specific",
      "admin.team.other",
    ];
    const result = PreprocessPermissions(input);

    expect(result).toEqual(["!admin.team.specific", "admin.team.other"]);
  });

  it("should handle single character permissions", () => {
    const input = ["!a", "a", "b", "!c"];
    const result = PreprocessPermissions(input);

    expect(result).toEqual(["!a", "!c", "b"]);
  });

  it("should preserve original array (immutability)", () => {
    const input = ["!admin.*", "admin.get", "user.post"];
    const originalInput = [...input];

    expect(PreprocessPermissions(input)).toEqual(["!admin.*", "user.post"]);
    expect(input).toEqual(originalInput);
  });
});

describe(EvaluatePrefix, () => {
  it("should handle single prefix correctly", () => {
    const permissions = ["admin.get", "user.post"];
    expect(EvaluatePrefix(["admin"], permissions)).toBe(true);
  });

  it("should handle OR logic - any match", () => {
    const permissions = ["user.get", "system.read"];
    expect(EvaluatePrefix(["OR", "admin", "user"], permissions)).toBe(true);
  });

  it("should handle OR logic - no match", () => {
    const permissions = ["system.read", "team.post"];
    expect(EvaluatePrefix(["OR", "admin", "user"], permissions)).toBe(false);
  });

  it("should handle AND logic - all match", () => {
    const permissions = ["admin.get", "user.post"];
    expect(EvaluatePrefix(["AND", "admin", "user"], permissions)).toBe(true);
  });

  it("should handle AND logic - partial match", () => {
    const permissions = ["admin.get", "system.read"];
    expect(EvaluatePrefix(["AND", "admin", "user"], permissions)).toBe(false);
  });

  it("should handle nested OR within AND", () => {
    const permissions = ["admin.get", "team.read"];
    expect(
      EvaluatePrefix(["AND", "admin", ["OR", "team", "user"]], permissions),
    ).toBe(true);
  });

  it("should handle nested AND within OR", () => {
    const permissions = ["user.get", "system.read"];
    expect(
      EvaluatePrefix(
        ["OR", ["AND", "admin", "team"], ["AND", "user", "system"]],
        permissions,
      ),
    ).toBe(true);
  });

  it("should handle complex nested logic", () => {
    const permissions = ["admin.get", "team.read"];
    expect(
      EvaluatePrefix(
        ["AND", ["OR", "admin", "moderator"], ["OR", "team", "user"]],
        permissions,
      ),
    ).toBe(true);
  });

  it("should handle negated permissions correctly", () => {
    const permissions = ["!admin.*", "admin.get", "user.post"];
    expect(EvaluatePrefix(["OR", "admin", "user"], permissions)).toBe(true); // user.post should survive
  });

  it("should handle empty nested arrays", () => {
    const permissions = ["admin.get", "user.post"];
    expect(EvaluatePrefix(["AND"], permissions)).toBe(false);
  });

  it("should handle global wildcard", () => {
    const permissions = ["*"];
    expect(EvaluatePrefix(["AND", "admin", "user"], permissions)).toBe(true);
  });

  it("should handle TTL exhaustion", () => {
    const permissions = ["admin.get"];
    expect(EvaluatePrefix(["OR", "admin", "user"], permissions, 0)).toBe(false); // TTL exhausted
  });

  it("should handle deeply nested structures", () => {
    const permissions = ["moderator.get", "system.read"];
    expect(
      EvaluatePrefix(
        [
          "OR",
          ["AND", "admin", ["OR", "team", "user"]],
          ["AND", "moderator", ["OR", "system", "config"]],
        ],
        permissions,
      ),
    ).toBe(true);
  });

  it("should handle case sensitivity", () => {
    const permissions = ["Admin.get", "User.post"];
    expect(EvaluatePrefix(["OR", "admin", "user"], permissions)).toBe(false);
  });

  it("should throw error for invalid operation", () => {
    const prefixes = ["INVALID", "admin", "user"] as unknown as Policy;
    const permissions = ["admin.get"];
    expect(() => EvaluatePrefix(prefixes, permissions)).toThrow(
      "Invalid policy expression",
    );
  });

  it("should handle mixed exact and prefix matches", () => {
    const permissions = ["admin", "user.get"]; // exact match and prefix match
    expect(EvaluatePrefix(["AND", "admin", "user"], permissions)).toBe(true);
  });

  it("should handle wildcard negatives", () => {
    const permissions = ["*", "!admin.*"];
    expect(EvaluatePrefix(["admin"], permissions)).toBe(false);
  });

  it("should handle wildcard positive that exact matches a negative", () => {
    const permissions = ["*", "!admin"];
    expect(EvaluatePrefix(["admin"], permissions)).toBe(false);
  });
});
