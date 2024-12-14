import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      reportsDirectory: "./dist/documentation/coverage",
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["src/schema/*.ts", "vitest.config.ts"],
    },
  },
});
