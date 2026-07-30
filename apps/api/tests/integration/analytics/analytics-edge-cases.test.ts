import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDatabasePool,
  type DatabasePool
} from "../../../src/infrastructure/database/client.js";
import { runMigrations } from "../../../src/infrastructure/database/migrate.js";
import { PostgresAnalyticsRepository } from "../../../src/modules/analytics/adapters/outbound/postgres-analytics-repository.js";
import { startTestEnvironment, type TestEnvironment } from "../../helpers/test-environment.js";

const integration = process.env.RUN_INTEGRATION === "true" ? describe : describe.skip;

integration("analytics edge cases", () => {
  let environment: TestEnvironment;
  let pool: DatabasePool;
  let repository: PostgresAnalyticsRepository;

  beforeAll(async () => {
    environment = await startTestEnvironment();
    pool = createDatabasePool(environment.databaseUrl);
    await runMigrations(pool);
    repository = new PostgresAnalyticsRepository(pool);
    await pool.query(
      `INSERT INTO interactions
         (id, raw_question, normalized_question, outcome, cache_status, created_at)
       VALUES
         ('00000000-0000-4000-8000-000000000201', 'Antes da meia-noite local',
          'limite local anterior', 'unanswered', 'miss', '2026-07-30T02:30:00.000Z'),
         ('00000000-0000-4000-8000-000000000202', 'Depois da meia-noite local',
          'limite local atual', 'unanswered', 'miss', '2026-07-30T03:30:00.000Z');
       INSERT INTO knowledge_gaps
         (normalized_question, representative_question, status, occurrence_count,
          first_seen_at, last_seen_at, version)
       VALUES
         ('gap aberto', 'Gap aberto', 'open', 1, now(), now(), 1),
         ('gap resolvido', 'Gap resolvido', 'resolved', 4, now(), now(), 2)`
    );
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await environment?.stop();
  });

  it("uses the organization time zone and keeps historical unanswered separate from backlog", async () => {
    const result = await repository.getSummary({
      from: "2026-07-30",
      to: "2026-07-30",
      timeZone: "America/Sao_Paulo",
      granularity: "day"
    });

    expect(result.totalQueries).toBe(1);
    expect(result.unansweredQueries).toBe(1);
    expect(result.timeline).toEqual([{ date: "2026-07-30", count: 1 }]);
    expect(result.categoryDistribution).toEqual([
      { categoryId: null, categoryName: "Sem categoria", count: 1 }
    ]);
    expect(result.knowledgeGapBacklog).toEqual({
      open: 1,
      resolving: 0,
      resolved: 1,
      dismissed: 0
    });
  });

  it("returns zeroes and empty series for a period without interactions", async () => {
    await expect(
      repository.getSummary({
        from: "2025-01-01",
        to: "2025-01-31",
        timeZone: "America/Sao_Paulo",
        granularity: "day"
      })
    ).resolves.toMatchObject({
      totalQueries: 0,
      answeredQueries: 0,
      unansweredQueries: 0,
      topQuestions: [],
      unansweredQuestions: [],
      categoryDistribution: [],
      timeline: [],
      knowledgeGapBacklog: { open: 1, resolving: 0, resolved: 1, dismissed: 0 }
    });
  });
});
