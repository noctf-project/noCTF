import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

export default defineConfig({
  plugins: [svelte({ compilerOptions: { dev: true } })],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.{test,spec}.{js,ts}"],
    server: {
      deps: {
        inline: [/svelte/],
      },
    },
  },
  resolve: {
    conditions: ["browser"],
    alias: {
      $lib: path.resolve(process.cwd(), "./src/lib"),
      "$app/navigation": path.resolve(process.cwd(), "./src/test-mocks.ts"),
      "$app/environment": path.resolve(process.cwd(), "./src/test-mocks.ts"),
      "$app/paths": path.resolve(process.cwd(), "./src/test-mocks.ts"),
    },
  },
});
