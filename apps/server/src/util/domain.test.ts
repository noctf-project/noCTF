import { describe, expect, test } from "vitest";
import { CompileDomainMatcher } from "./domain.ts";

describe(CompileDomainMatcher, () => {
  test.each([
    { pattern: "*.example.com", domain: "a.example.com", expected: true },
    { pattern: "*.example.com", domain: "b.example.com", expected: true },
    { pattern: "*.example.com", domain: "example.com", expected: false },
    { pattern: "*.example.com", domain: "a.b.example.com", expected: false },
    { pattern: "*.*.example.com", domain: "a.b.example.com", expected: true },
    { pattern: "*.*.example.com", domain: "a.example.com", expected: false },
    { pattern: "example.com", domain: "example.com", expected: true },
    { pattern: "example.com", domain: "a.example.com", expected: false },
    { pattern: "*.a.example.com", domain: "b.a.example.com", expected: true },
    { pattern: "*.a.example.com", domain: "a.example.com", expected: false },
  ])("Single Pattern Tests", ({ pattern, domain, expected }) => {
    expect(!!domain.match(CompileDomainMatcher(pattern))).toBe(expected);
  });

  test.each([
    {
      patterns: ["*.example.com", "example.org"],
      domain: "a.example.com",
      expected: true,
    },
    {
      patterns: ["*.example.com", "example.org"],
      domain: "example.com",
      expected: false,
    },
    {
      patterns: ["*.example.com", "example.org"],
      domain: "example.org",
      expected: true,
    },
    {
      patterns: ["*.example.com", "example.org"],
      domain: "a.example.org",
      expected: false,
    },
    {
      patterns: ["site.com", "blog.site.com"],
      domain: "blog.site.com",
      expected: true,
    },
    {
      patterns: ["site.com", "blog.site.com"],
      domain: "dev.site.com",
      expected: false,
    },
  ])("Multi Pattern Tests", ({ patterns, domain, expected }) => {
    expect(!!domain.match(CompileDomainMatcher(patterns))).toBe(expected);
  });
});
