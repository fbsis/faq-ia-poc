import { defineConfig } from "@playwright/test";

const isCi = process.env.CI === "true";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: isCi ? 2 : 0,
  reporter: isCi ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "pnpm --filter @faq/web dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !isCi,
    timeout: 120_000
  }
});
