import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabasePool } from "../../../src/infrastructure/database/client.js";
import { runMigrations } from "../../../src/infrastructure/database/migrate.js";
import { PostgresAuthRepository } from "../../../src/modules/auth/adapters/outbound/postgres-auth-repository.js";
import { startTestEnvironment, type TestEnvironment } from "../../helpers/test-environment.js";

const integration = process.env.RUN_INTEGRATION === "true" ? describe : describe.skip;

integration("PostgresAuthRepository", () => {
  let environment: TestEnvironment;
  let repository: PostgresAuthRepository;

  beforeAll(async () => {
    environment = await startTestEnvironment();
    const pool = createDatabasePool(environment.databaseUrl);
    await runMigrations(pool);
    repository = new PostgresAuthRepository(pool);
  }, 120_000);

  afterAll(async () => {
    await environment?.stop();
  });

  it("does not return expired or revoked sessions", async () => {
    await repository.createSession({
      id: "00000000-0000-4000-8000-000000000001",
      adminId: "00000000-0000-4000-8000-000000000002",
      tokenHash: "hash",
      csrfToken: "csrf",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2026-01-01T01:00:00.000Z"),
      revokedAt: null
    });

    await expect(
      repository.findSessionByTokenHash("hash", new Date("2026-01-01T02:00:00.000Z"))
    ).resolves.toBeNull();
  });
});
