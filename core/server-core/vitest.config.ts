import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/*.integ.test.ts"],
    coverage: {
      reportsDirectory: "./dist/documentation/coverage",
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**"],
      exclude: ["vitest.config.ts", "**/**.test.ts"],
    },
    fakeTimers: {
      toFake: [...(configDefaults.fakeTimers.toFake || []), "performance"],
    },
  },
});
