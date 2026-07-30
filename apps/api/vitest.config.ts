import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "api",
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      thresholds: { lines: 80, branches: 80 },
      include: ["src/modules/**/{domain,application}/**/*.ts"]
    }
  }
});
