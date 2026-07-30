import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(process.cwd(), "../..");

describe("Docker database migrations", () => {
  it("blocks development API processes until the migration service succeeds", async () => {
    const compose = await readFile(resolve(repositoryRoot, "compose.yaml"), "utf8");

    expect(compose).toContain("migrate:");
    expect(compose).toContain('command: ["pnpm", "--filter", "@faq/api", "db:migrate"]');
    expect(compose.match(/migrate: \{ condition: service_completed_successfully \}/g)).toHaveLength(
      3
    );
  });

  it("packages migrations and applies them before production API processes", async () => {
    const [compose, dockerfile] = await Promise.all([
      readFile(resolve(repositoryRoot, "compose.production.yaml"), "utf8"),
      readFile(resolve(repositoryRoot, "docker/api.Dockerfile"), "utf8")
    ]);

    expect(compose).toContain("migrate:");
    expect(compose).toContain(
      'command: ["node", "dist/infrastructure/database/migrate.js"]'
    );
    expect(compose.match(/migrate: \{ condition: service_completed_successfully \}/g)).toHaveLength(
      3
    );
    expect(dockerfile).toContain(
      "apps/api/src/infrastructure/database/migrations ./dist/infrastructure/database/migrations"
    );
  });
});
