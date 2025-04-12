export type DomainPattern = string | string[];

export type DomainMatcher = (domain: string) => boolean;

/**
 * Converts a single glob pattern to a regex pattern string
 * @param pattern - The glob pattern to convert
 * @returns The regex pattern string
 */
function GlobToRegexPattern(pattern: string): string {
  return pattern
    .replace(/\./g, "\\.") // Escape dots
    .replace(/\*/g, "([^.]+)") // Replace * with regex for "any characters except dot"
    .replace(/\\\.\\\./g, "\\."); // Clean up any double dots that might appear
}

/**
 * Create a compiled regex from multiple patterns for efficient matching
 * @param patterns - List of glob patterns or a single pattern
 * @returns Combined regex that matches any of the patterns
 */
export function CompileDomainMatcher(patterns: string | string[]): RegExp {
  if (typeof patterns === "string") {
    const regexPattern = GlobToRegexPattern(patterns.toLowerCase());
    return new RegExp(`^(http|https)://${regexPattern}(:[0-9]+)?$`);
  }

  const regexPatterns = patterns.map((pattern) => {
    pattern = pattern.toLowerCase();

    if (!pattern.includes("*")) {
      return pattern.replace(/\./g, "\\.");
    }

    return GlobToRegexPattern(pattern);
  });

  const combinedPattern = regexPatterns.map((p) => `(${p})`).join("|");
  return new RegExp(`^(http|https)://(?:${combinedPattern})(:[0-9]+)?$`);
}
