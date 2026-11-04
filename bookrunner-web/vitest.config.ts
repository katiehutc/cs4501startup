
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", "e2e/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["lib/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
        "lib/contracts.ts",
        "lib/types.ts",
      ],
    },
  },
});
