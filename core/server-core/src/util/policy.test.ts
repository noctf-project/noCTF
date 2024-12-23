import { expect, it } from "vitest";
import type { Policy } from "./policy.ts";
import { Evaluate } from "./policy.ts";

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

  expect(Evaluate(["OR", "admin.challenges", "admin.user"], permissions)).toBe(
    true,
  );
  expect(Evaluate(["AND", "admin.challenges", "admin.user"], permissions)).toBe(
    true,
  );
  expect(
    Evaluate(["OR", "admin.user.update", "admin.challenges.get"], permissions),
  ).toBe(true);
  expect(
    Evaluate(["AND", "admin.user.update", "admin.challenges.get"], permissions),
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
