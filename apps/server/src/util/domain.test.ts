import { describe, expect, test } from "vitest";
import { CompileDomainMatcher } from "./domain.ts";

describe(CompileDomainMatcher, () => {
  test.each([
    { pattern: "*.example.com", host: "http://a.example.com", expected: true },
    { pattern: "*.example.com", host: "http://b.example.com", expected: true },
    { pattern: "*.example.com", host: "http://example.com", expected: false },
    {
      pattern: "*.example.com",
      host: "http://a.b.example.com",
      expected: false,
    },
    {
      pattern: "*.*.example.com",
      host: "http://a.b.example.com",
      expected: true,
    },
    {
      pattern: "*.*.example.com",
      host: "http://a.example.com",
      expected: false,
    },
    { pattern: "example.com", host: "http://example.com", expected: true },
    { pattern: "example.com", host: "http://example.com:", expected: false },
    { pattern: "example.com", host: "http://example.com:8080", expected: true },
    { pattern: "example.com", host: "http://a.example.com", expected: false },
    {
      pattern: "*.a.example.com",
      host: "http://b.a.example.com",
      expected: true,
    },
    {
      pattern: "*.a.example.com",
      host: "http://a.example.com",
      expected: false,
    },
  ])("Single Pattern Tests %s", ({ pattern, host, expected }) => {
    expect(!!host.match(CompileDomainMatcher(pattern))).toBe(expected);
  });

  test.each([
    {
      patterns: ["*.example.com", "example.org"],
      host: "https://a.example.com",
      expected: true,
    },
    {
      patterns: ["*.example.com", "example.org"],
      host: "https://example.com",
      expected: false,
    },
    {
      patterns: ["*.example.com", "example.org"],
      host: "https://example.org",
      expected: true,
    },
    {
      patterns: ["*.example.com", "example.org"],
      host: "https://a.example.org",
      expected: false,
    },
    {
      patterns: ["site.com", "blog.site.com"],
      host: "https://blog.site.com",
      expected: true,
    },
    {
      patterns: ["site.com", "blog.site.com"],
      host: "https://dev.site.com",
      expected: false,
    },
  ])("Multi Pattern Tests", ({ patterns, host, expected }) => {
    expect(!!host.match(CompileDomainMatcher(patterns))).toBe(expected);
  });
});
