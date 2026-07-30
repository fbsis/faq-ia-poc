import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDatabasePool,
  type DatabasePool
} from "../../../src/infrastructure/database/client.js";
import { runMigrations } from "../../../src/infrastructure/database/migrate.js";
import { PostgresAnalyticsRepository } from "../../../src/modules/analytics/adapters/outbound/postgres-analytics-repository.js";
import { startTestEnvironment, type TestEnvironment } from "../../helpers/test-environment.js";

const integration = process.env.RUN_INTEGRATION === "true" ? describe : describe.skip;

integration("PostgresAnalyticsRepository", () => {
  let environment: TestEnvironment;
  let pool: DatabasePool;
  let repository: PostgresAnalyticsRepository;

  beforeAll(async () => {
    environment = await startTestEnvironment();
    pool = createDatabasePool(environment.databaseUrl);
    await runMigrations(pool);
    repository = new PostgresAnalyticsRepository(pool);
    await seedAnalyticsData(pool);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await environment?.stop();
  });

  it("projects totals, grouped questions, unanswered topics, and categories", async () => {
    const result = await repository.getSummary({
      from: "2026-07-01",
      to: "2026-07-31",
      timeZone: "America/Sao_Paulo",
      granularity: "day"
    });

    expect(result).toMatchObject({
      totalQueries: 3,
      answeredQueries: 1,
      unansweredQueries: 2,
      topQuestions: [
        { question: "Como redefino minha senha?", count: 2 },
        { question: "Pergunta sem categoria", count: 1 }
      ],
      unansweredQuestions: [
        expect.objectContaining({ question: "Como redefino minha senha?", count: 1 }),
        expect.objectContaining({ question: "Pergunta sem categoria", count: 1 })
      ]
    });
    expect(result.categoryDistribution).toEqual(
      expect.arrayContaining([
        { categoryId: "00000000-0000-4000-8000-000000000001", categoryName: "Conta", count: 2 },
        { categoryId: null, categoryName: "Sem categoria", count: 1 }
      ])
    );
  });
});

async function seedAnalyticsData(pool: DatabasePool) {
  await pool.query(
    `INSERT INTO categories (id, name, slug)
     VALUES ('00000000-0000-4000-8000-000000000001', 'Conta', 'conta');
     INSERT INTO interactions
       (id, raw_question, normalized_question, outcome, category_id, answer_snapshot,
        source_answer_snapshot, category_snapshot, cache_status, created_at)
     VALUES
       ('00000000-0000-4000-8000-000000000101', 'Como redefino minha senha?',
        'como redefino minha senha', 'answered',
        '00000000-0000-4000-8000-000000000001', 'Use a recuperação.',
        'Use a recuperação.', 'Conta', 'miss',
        '2026-07-10T12:00:00.000Z'),
       ('00000000-0000-4000-8000-000000000102', 'Esqueci minha senha',
        'como redefino minha senha', 'unanswered',
        '00000000-0000-4000-8000-000000000001', NULL, NULL, 'Conta', 'miss',
        '2026-07-11T12:00:00.000Z'),
       ('00000000-0000-4000-8000-000000000103', 'Pergunta sem categoria',
        'pergunta sem categoria', 'ambiguous', NULL, NULL, NULL, NULL, 'bypassed',
        '2026-07-12T12:00:00.000Z')`
  );
}
