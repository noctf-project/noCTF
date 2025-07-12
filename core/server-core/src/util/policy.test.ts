import { describe, expect, it } from "vitest";
import type { Policy } from "./policy.ts";
import { Evaluate, EvaluatePrefixes, PreprocessPermissions } from "./policy.ts";

describe(Evaluate, () => {
  const Wrapped = (
    ...[policy, permissions, ...rest]: Parameters<typeof Evaluate>
  ) => Evaluate(policy, PreprocessPermissions(permissions), ...rest);
  it("Evaluates single scalar policies", () => {
    const permissions = [
      "admin.user.*",
      "admin.challenges.*",
      "!admin.user.update",
    ];

    expect(Wrapped(["admin.user"], permissions)).toBe(true);
    expect(Wrapped(["admin.user.update"], permissions)).toBe(false);
    expect(Wrapped(["admin.config"], permissions)).toBe(false);
    expect(Wrapped(["admin.challenges"], permissions)).toBe(true);
    expect(Wrapped(["admin.challenges"], ["!*", "admin.challenges.*"])).toBe(
      false,
    );
    expect(Wrapped(["user.get"], permissions)).toBe(false);
  });

  it("Evaluates multi scalar policies", () => {
    const permissions = [
      "*",
      "admin.user.*",
      "admin.challenges.*",
      "!admin.user.update",
    ];

    expect(Wrapped(["OR", "admin.challenges", "admin.user"], permissions)).toBe(
      true,
    );
    expect(
      Wrapped(["AND", "admin.challenges", "admin.user"], permissions),
    ).toBe(true);
    expect(
      Wrapped(["OR", "admin.user.update", "admin.challenges.get"], permissions),
    ).toBe(true);
    expect(
      Wrapped(
        ["AND", "admin.user.update", "admin.challenges.get"],
        permissions,
      ),
    ).toBe(false);
  });

  it("Should not match longer prefixes", () => {
    const permissions = ["admin.user"];

    expect(Wrapped(["admin.user.get"], permissions)).toBe(false);
  });

  it("Evaluates nested policies", () => {
    const permissions = ["admin.user.*"];

    expect(
      Wrapped(
        [
          "OR",
          ["OR", "admin.challenges", "admin.user"],
          ["AND", "admin.challenges", "admin.user"],
        ],
        permissions,
      ),
    ).toBe(true);

    expect(
      Wrapped(
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
      Wrapped(
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
      Wrapped(
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
      Wrapped(["NO", "admin.user"] as unknown as Policy, permissions),
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

describe(EvaluatePrefixes, () => {
  const Wrapped = (
    ...[prefixes, permissions]: Parameters<typeof EvaluatePrefixes>
  ) => EvaluatePrefixes(prefixes, PreprocessPermissions(permissions));

  it("should remove matching prefixes from set and return them", () => {
    const prefixes = new Set(["admin", "user", "system"]);
    const permissions = ["admin.get", "user.post", "team.read"];
    const result = Wrapped(prefixes, permissions);

    expect(result).toEqual(["admin", "user"]);
    expect(Array.from(prefixes)).toEqual(["system"]);
  });

  it("should remove all prefixes with global wildcard", () => {
    const prefixes = new Set(["admin", "user", "system"]);
    const permissions = ["*"];
    const result = Wrapped(prefixes, permissions);

    expect(result).toEqual(["admin", "user", "system"]);
    expect(Array.from(prefixes)).toEqual([]);
  });

  it("should respect negative permissions", () => {
    const prefixes = new Set(["admin", "user", "system"]);
    const permissions = ["*", "!admin.*"];
    const result = Wrapped(prefixes, permissions);

    expect(result).toEqual(["user", "system"]);
    expect(Array.from(prefixes)).toEqual(["admin"]);
  });

  it("should return empty array when no prefixes match", () => {
    const prefixes = new Set(["admin", "user", "system"]);
    const permissions = ["team.read", "other.write"];
    const result = Wrapped(prefixes, permissions);

    expect(result).toEqual([]);
    expect(Array.from(prefixes)).toEqual(["admin", "user", "system"]);
  });

  it("should handle empty set", () => {
    const prefixes = new Set<string>();
    const permissions = ["admin.get", "user.post"];
    const result = Wrapped(prefixes, permissions);

    expect(result).toEqual([]);
    expect(Array.from(prefixes)).toEqual([]);
  });

  it("should handle empty permissions", () => {
    const prefixes = new Set(["admin", "user", "system"]);
    const permissions: string[] = [];
    const result = Wrapped(prefixes, permissions);

    expect(result).toEqual([]);
    expect(Array.from(prefixes)).toEqual(["admin", "user", "system"]);
  });

  it("should handle mixed exact and prefix matches", () => {
    const prefixes = new Set(["admin", "user", "team"]);
    const permissions = ["admin", "user.get", "other.read"];
    const result = Wrapped(prefixes, permissions);

    expect(result).toEqual(["admin", "user"]);
    expect(Array.from(prefixes)).toEqual(["team"]);
  });

  it("should handle specific negations", () => {
    const prefixes = new Set(["admin", "user", "system"]);
    const permissions = ["admin.get", "user.post", "!admin"];
    const result = Wrapped(prefixes, permissions);

    expect(result).toEqual(["user"]);
    expect(Array.from(prefixes)).toEqual(["admin", "system"]);
  });

  it("should handle complex permission scenarios", () => {
    const prefixes = new Set(["admin", "user", "team", "system"]);
    const permissions = [
      "!admin.team.*",
      "admin.user.get",
      "team.read",
      "system.write",
    ];
    const result = Wrapped(prefixes, permissions);

    expect(result).toEqual(["admin", "team", "system"]);
    expect(Array.from(prefixes)).toEqual(["user"]);
  });

  it("should handle case sensitivity", () => {
    const prefixes = new Set(["admin", "user", "system"]);
    const permissions = ["Admin.get", "USER.post", "system.read"];
    const result = Wrapped(prefixes, permissions);

    expect(result).toEqual(["system"]);
    expect(Array.from(prefixes)).toEqual(["admin", "user"]);
  });

  it("should handle single character prefixes", () => {
    const prefixes = new Set(["a", "b", "c"]);
    const permissions = ["a.read", "b", "other.write"];
    const result = Wrapped(prefixes, permissions);

    expect(result).toEqual(["a", "b"]);
    expect(Array.from(prefixes)).toEqual(["c"]);
  });

  it("should handle global denial", () => {
    const prefixes = new Set(["admin", "user", "system"]);
    const permissions = ["!*"];
    const result = Wrapped(prefixes, permissions);

    expect(result).toEqual([]);
    expect(Array.from(prefixes)).toEqual(["admin", "user", "system"]);
  });

  it("should mutate the original set", () => {
    const prefixes = new Set(["admin", "user", "system"]);
    const originalSet = prefixes; // Same reference
    const result = Wrapped(prefixes, ["admin.get"]);

    expect(result).toEqual(["admin"]);
    expect(originalSet).toBe(prefixes); // Same reference
    expect(Array.from(originalSet)).toEqual(["user", "system"]);
  });

  it("should handle complex wildcard and negation combinations", () => {
    const prefixes = new Set(["admin", "user", "team", "system"]);
    const permissions = ["*", "!admin.*", "!user"];
    const result = Wrapped(prefixes, permissions);

    expect(result).toEqual(["team", "system"]);
    expect(Array.from(prefixes)).toEqual(["admin", "user"]);
  });

  it("should handle wildcard negatives", () => {
    const prefixes = new Set(["admin"]);
    const permissions = ["*", "!admin.*"];
    expect(Wrapped(prefixes, permissions)).toEqual([]);
  });

  it("should handle wildcard positive that exact matches a negative", () => {
    const prefixes = new Set(["admin"]);
    const permissions = ["*", "!admin"];
    expect(Wrapped(prefixes, permissions)).toEqual([]);
  });
});
