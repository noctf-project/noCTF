import { expect, it } from "vitest";
import { EvaluateFilter } from "./filter.ts";

it("null filter returns true", () => {
  expect(EvaluateFilter(null, {})).toEqual(true);
});
it("pass: =", () => {
  expect(EvaluateFilter({ a: ["=", 0] }, { a: 0 })).toEqual(true);
});
it("fail: =", () => {
  expect(EvaluateFilter({ a: ["=", 0] }, { a: 1 })).toEqual(false);
});
it("pass: array =", () => {
  expect(EvaluateFilter({ a: ["=", [0, 1]] }, { a: 0 })).toEqual(true);
  expect(EvaluateFilter({ a: ["=", [0, 1]] }, { a: 1 })).toEqual(true);
});
it("fail: array =", () => {
  expect(EvaluateFilter({ a: ["=", [0, 1]] }, { a: 2 })).toEqual(false);
});
it("pass: !", () => {
  expect(EvaluateFilter({ a: ["!", 0] }, { a: 1 })).toEqual(true);
});
it("fail: !", () => {
  expect(EvaluateFilter({ a: ["!", 0] }, { a: 0 })).toEqual(false);
});
it("pass: array !", () => {
  expect(EvaluateFilter({ a: ["!", [0, 1]] }, { a: 2 })).toEqual(true);
});
it("fail: array !", () => {
  expect(EvaluateFilter({ a: ["!", [0, 1]] }, { a: 0 })).toEqual(false);
  expect(EvaluateFilter({ a: ["!", [0, 1]] }, { a: 1 })).toEqual(false);
});
it("pass: >", () => {
  expect(EvaluateFilter({ a: [">", 0] }, { a: 1 })).toEqual(true);
});
it("fail: >", () => {
  expect(EvaluateFilter({ a: [">", 0] }, { a: 0 })).toEqual(false);
  expect(EvaluateFilter({ a: [">", 0] }, { a: -1 })).toEqual(false);
});
it("pass: array >", () => {
  expect(EvaluateFilter({ a: [">", [0, 1]] }, { a: 0 })).toEqual(true);
});
it("pass: >=", () => {
  expect(EvaluateFilter({ a: [">=", 0] }, { a: 0 })).toEqual(true);
  expect(EvaluateFilter({ a: [">=", 0] }, { a: 1 })).toEqual(true);
});
it("fail: >=", () => {
  expect(EvaluateFilter({ a: [">=", 0] }, { a: -1 })).toEqual(false);
});
it("pass: array >=", () => {
  expect(EvaluateFilter({ a: [">=", [0, 1]] }, { a: 0 })).toEqual(true);
});
it("pass: <", () => {
  expect(EvaluateFilter({ a: ["<", 0] }, { a: -1 })).toEqual(true);
});
it("fail: <", () => {
  expect(EvaluateFilter({ a: ["<", 0] }, { a: 0 })).toEqual(false);
  expect(EvaluateFilter({ a: ["<", 0] }, { a: 1 })).toEqual(false);
});
it("pass: array <", () => {
  expect(EvaluateFilter({ a: ["<", [0, 1]] }, { a: 0 })).toEqual(true);
});
it("pass: <=", () => {
  expect(EvaluateFilter({ a: ["<=", 0] }, { a: 0 })).toEqual(true);
  expect(EvaluateFilter({ a: ["<=", 0] }, { a: -1 })).toEqual(true);
});
it("fail: <=", () => {
  expect(EvaluateFilter({ a: ["<=", 0] }, { a: 1 })).toEqual(false);
});
it("pass: array <=", () => {
  expect(EvaluateFilter({ a: ["<=", [0, 1]] }, { a: 0 })).toEqual(true);
});
it("pass: default", () => {
  expect(EvaluateFilter({ a: ["" as "=", 0] }, { a: 0 })).toEqual(true);
});
it("pass: object", () => {
  expect(EvaluateFilter({ a: { b: ["=", 0] } }, { a: { b: 0 } })).toEqual(true);
});
it("fail: object", () => {
  expect(EvaluateFilter({ a: { b: ["!", 0] } }, { a: { b: 0 } })).toEqual(
    false,
  );
});
it("pass: bail primitive", () => {
  expect(EvaluateFilter({ a: ["=", 0] }, { a: { b: "c" } })).toEqual(true);
});
it("pass: empty object", () => {
  expect(EvaluateFilter({ a: { b: ["=", 0] } }, {})).toEqual(true);
});
it("pass: bail exceeded TTL", () => {
  expect(EvaluateFilter({ a: { b: ["!", 0] } }, { a: { b: 0 } }, 1)).toEqual(
    true,
  );
});
