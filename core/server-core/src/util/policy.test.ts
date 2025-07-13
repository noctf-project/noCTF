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

  it("Negative wildcards override positive wildcards", () => {
    const permissions = ["!admin.*", "*"];

    expect(Wrapped(["admin.user.get"], permissions)).toBe(false);
    expect(Wrapped(["user.get"], permissions)).toBe(true);
  });

  it("Negative wildcards override positive wildcards", () => {
    const permissions = ["!*", "*"];

    expect(Wrapped(["admin.user.get"], permissions)).toBe(false);
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

  it("Should match when permission with wildcard matches a shorter policy", () => {
    const permissions = ["admin.user.*"];

    expect(Wrapped(["admin.user"], permissions)).toBe(true);
    expect(Wrapped(["admin"], permissions)).toBe(false);
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

  it("should handle permissions with multiple dots", () => {
    const permissions = [
      "admin.user.settings.*",
      "!admin.user.settings.password",
    ];

    expect(Wrapped(["admin.user.settings.profile"], permissions)).toBe(true);
    expect(Wrapped(["admin.user.settings.password"], permissions)).toBe(false);
    expect(Wrapped(["admin.user.settings.theme.dark"], permissions)).toBe(true);
  });

  it("should handle overlapping wildcard patterns", () => {
    const permissions = ["admin.*", "admin.user.*", "!admin.user.delete"];

    expect(Wrapped(["admin.config"], permissions)).toBe(true);
    expect(Wrapped(["admin.user.get"], permissions)).toBe(true);
    expect(Wrapped(["admin.user.delete"], permissions)).toBe(false);
  });

  it("should handle permissions with numbers", () => {
    const permissions = [
      "api.v1.*",
      "api.v2.read",
      "!api.v1.admin",
      "user123.read",
    ];

    expect(Wrapped(["api.v1.users"], permissions)).toBe(true);
    expect(Wrapped(["api.v1.admin"], permissions)).toBe(false);
    expect(Wrapped(["api.v2.read"], permissions)).toBe(true);
    expect(Wrapped(["user123.read"], permissions)).toBe(true);
  });

  it("should handle multiple negations of the same permission", () => {
    const permissions = [
      "*",
      "!admin.delete",
      "!admin.delete",
      "!admin.delete",
    ];

    expect(Wrapped(["admin.delete"], permissions)).toBe(false);
    expect(Wrapped(["admin.read"], permissions)).toBe(true);
  });

  it("should handle complex nested OR/AND with edge cases", () => {
    const permissions = ["admin.read", "user.write", "!system.delete"];

    expect(
      Wrapped(
        [
          "OR",
          ["AND", "admin.read", "nonexistent.permission"],
          ["AND", "user.write", "admin.read"],
        ],
        permissions,
      ),
    ).toBe(true);

    expect(
      Wrapped(
        [
          "AND",
          ["OR", "admin.read", "user.write"],
          ["OR", "system.delete", "nonexistent.permission"],
        ],
        permissions,
      ),
    ).toBe(false);
  });

  it("should handle deeply nested policies with mixed operations", () => {
    const permissions = ["admin.*", "user.read", "!admin.sensitive"];

    expect(
      Wrapped(
        [
          "OR",
          [
            "AND",
            ["OR", "admin.config", "user.read"],
            ["AND", "admin.users", "user.read"],
          ],
          "admin.sensitive",
        ],
        permissions,
      ),
    ).toBe(true);
  });

  it("should handle policies with single item arrays", () => {
    const permissions = ["admin.read", "user.write"];

    expect(Wrapped(["OR", "admin.read"], permissions)).toBe(true);
    expect(Wrapped(["AND", "admin.read"], permissions)).toBe(true);
    expect(Wrapped(["OR", "nonexistent"], permissions)).toBe(false);
    expect(Wrapped(["AND", "nonexistent"], permissions)).toBe(false);
  });

  it("should handle TTL edge cases", () => {
    const permissions = ["admin.read"];

    expect(Wrapped(["admin.read"], permissions, 0)).toBe(false);
    expect(Wrapped(["admin.read"], permissions, 1)).toBe(true);
    expect(Wrapped(["admin.read"], permissions, -1)).toBe(false);
  });

  it("should handle malformed policy arrays", () => {
    const permissions = ["admin.read"];

    expect(() =>
      Wrapped(["INVALID_OP", "admin.read"] as unknown as Policy, permissions),
    ).toThrowError("Invalid policy expression");
  });

  it("should handle empty policy arrays", () => {
    const permissions = ["admin.read"];

    expect(() => Wrapped([] as unknown as Policy, permissions)).toThrowError();
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

  it("should handle mixed negations and wildcards", () => {
    const input = ["!*", "admin.*", "user.read", "!admin.delete"];
    const result = PreprocessPermissions(input);

    expect(result).toEqual(["!*"]);
  });

  it("should handle permissions with numbers", () => {
    const input = ["api.v1.*", "user123.read", "!api.v1.admin"];
    const result = PreprocessPermissions(input);

    expect(result).toEqual(["!api.v1.admin", "api.v1.*", "user123.read"]);
  });

  it("should handle single character permissions with wildcards", () => {
    const input = ["a.*", "a.b", "!a.c"];
    const result = PreprocessPermissions(input);

    expect(result).toEqual(["!a.c", "a.*", "a.b"]);
  });

  it("should handle permissions with dots but no wildcards at various positions", () => {
    const input = ["admin.team.lead", "admin.team.member", "!admin.team.lead"];
    const result = PreprocessPermissions(input);

    expect(result).toEqual(["!admin.team.lead", "admin.team.member"]);
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

  it("should handle prefixes with numbers", () => {
    const prefixes = new Set(["api1", "api2", "user123"]);
    const permissions = ["api1.read", "api2.*", "user456.write"];
    const result = Wrapped(prefixes, permissions);

    expect(result).toEqual(["api1", "api2"]);
    expect(Array.from(prefixes)).toEqual(["user123"]);
  });

  it("should handle prefixes that are substrings of each other", () => {
    const prefixes = new Set(["admin", "administrator", "adm"]);
    const permissions = ["admin.read", "administrator.config"];
    const result = Wrapped(prefixes, permissions);

    expect(result).toEqual(["admin", "administrator"]);
    expect(Array.from(prefixes)).toEqual(["adm"]);
  });

  it("should handle overlapping wildcard negations", () => {
    const prefixes = new Set(["admin", "user", "system"]);
    const permissions = ["*", "!admin.*", "!user"];
    const result = Wrapped(prefixes, permissions);

    expect(result).toEqual(["system"]);
    expect(Array.from(prefixes)).toEqual(["admin", "user"]);
  });

  it("should handle exact match negations with wildcards", () => {
    const prefixes = new Set(["admin", "user", "guest"]);
    const permissions = ["admin.*", "user.read", "!admin", "guest"];
    const result = Wrapped(prefixes, permissions);

    expect(result.sort()).toEqual(["guest", "user"]);
    expect(Array.from(prefixes)).toEqual(["admin"]);
  });

  it("should handle single character prefixes with wildcards", () => {
    const prefixes = new Set(["a", "b", "c"]);
    const permissions = ["a.*", "b.read", "!a"];
    const result = Wrapped(prefixes, permissions);

    expect(result).toEqual(["b"]);
    expect(Array.from(prefixes)).toEqual(["a", "c"]);
  });

  it("should handle prefixes that match permission prefixes exactly", () => {
    const prefixes = new Set(["admin.user", "admin.config", "user"]);
    const permissions = ["admin.user.read", "admin.config.*", "user.write"];
    const result = Wrapped(prefixes, permissions);

    expect(result).toEqual(["admin.user", "admin.config", "user"]);
    expect(Array.from(prefixes)).toEqual([]);
  });

  it("should handle negation of specific prefix in wildcard context", () => {
    const prefixes = new Set(["admin", "user", "guest"]);
    const permissions = ["*", "!admin.*", "admin.safe"];
    const result = Wrapped(prefixes, permissions);
    expect(result.sort()).toEqual(["guest", "user"]);
    expect(Array.from(prefixes)).toEqual(["admin"]);
  });
});
