import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Separate from vitest.config.ts so the paid eval never runs in npm test or CI.
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.eval.ts"],
    testTimeout: 600_000,
    env: loadEnv("", process.cwd(), ""),
  },
});
