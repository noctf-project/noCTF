import { expect, it } from "vitest";
import { Evaluate } from "./policy.ts";

it("Evaluates single scalar policies", () => {
  const permissions = [
    "admin.user",
    "!admin",
    "admin.challenges"
  ];
  
  expect(Evaluate(["OR", "admin.user"], permissions)).toBe(true);
  expect(Evaluate(["AND", "admin.user"], permissions)).toBe(true);
  expect(Evaluate(["OR","admin.config"], permissions)).toBe(false);
  expect(Evaluate(["AND","admin.config"], permissions)).toBe(false);
  expect(Evaluate(["OR","admin.challenges"], permissions)).toBe(true);
  expect(Evaluate(["OR","user.get"], permissions)).toBe(false);
});

it("Evaluates multi scalar policies", () => {
  const permissions = [
    "admin.user",
    "admin.stats",
    "!admin",
  ];
  
  expect(Evaluate(["OR","admin.challenges", "admin.user"], permissions)).toBe(true);
  expect(Evaluate(["AND", "admin.challenges", "admin.user"], permissions)).toBe(false);
  expect(Evaluate(["AND", "admin.stats", "admin.user"], permissions)).toBe(true);
});

it("Evaluates nested policies", () => {
  const permissions = [
    "admin.user",
    "admin.stats",
    "!admin",
  ];
  
  expect(Evaluate(["OR",
    ["OR", "admin.challenges", "admin.user"],
    ["AND", "admin.challenges", "admin.user"]
  ], permissions)).toBe(true);

  expect(Evaluate(["AND",
    ["OR", "admin.challenges", "admin.user"],
    ["AND", "admin.challenges", "admin.user"]
  ], permissions)).toBe(false);
});

it("Fails to evaluate deeply nested policies according to TTL", () => {
  const permissions = [
    "admin.user",
    "admin.stats",
    "!admin",
  ];
  
  expect(Evaluate(["OR",
    ["OR", ["OR", ["OR", "admin.challenges", "admin.user"]]],
    ["AND", "admin.challenges", "admin.user"]
  ], permissions, 2)).toBe(false);
});

it("Evaluates policies with modifiers", () => {
  const permissions = [
    "admin.user:r",
    "admin.stats:rw",
    "admin.challenges",
    "admin.score:rwx",
    "!admin.score:w",
    "admin.score2",
    "!admin.score2:w",
    "!admin",
    ":r"
  ];
  
  expect(Evaluate(["OR", "admin.user:r"], permissions)).toBe(true);
  expect(Evaluate(["OR", "admin.stats:r"], permissions)).toBe(true);
  expect(Evaluate(["OR", "admin.stats:w"], permissions)).toBe(true);
  expect(Evaluate(["OR", "admin.stats:rw"], permissions)).toBe(true);
  expect(Evaluate(["OR", "admin.stats:rwx"], permissions)).toBe(false);
  expect(Evaluate(["OR", "admin.challenges:r"], permissions)).toBe(true);
  expect(Evaluate(["OR", "admin.challenges:w"], permissions)).toBe(true);
  expect(Evaluate(["OR", "admin.score:w"], permissions)).toBe(false);
  expect(Evaluate(["OR", "admin.score:r"], permissions)).toBe(true);
  expect(Evaluate(["OR", "admin.score2:w"], permissions)).toBe(false);
  expect(Evaluate(["OR", "admin.score2:r"], permissions)).toBe(true);
  expect(Evaluate(["OR", "admin.me"], permissions)).toBe(false);
  expect(Evaluate(["OR", "user.me"], permissions)).toBe(false);
});