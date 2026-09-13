import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.integ.test.ts"],
    setupFiles: ["./src/test/integ-setup.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    slowTestThreshold: 2000,
  },
});
