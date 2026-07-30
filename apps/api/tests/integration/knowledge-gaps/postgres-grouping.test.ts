import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDatabasePool,
  type DatabasePool
} from "../../../src/infrastructure/database/client.js";
import { runMigrations } from "../../../src/infrastructure/database/migrate.js";
import { PostgresUnansweredRecorder } from "../../../src/modules/knowledge-gaps/adapters/outbound/postgres-unanswered-recorder.js";
import type { Interaction } from "../../../src/modules/chat/domain/interaction.js";
import { startTestEnvironment, type TestEnvironment } from "../../helpers/test-environment.js";

const integration = process.env.RUN_INTEGRATION === "true" ? describe : describe.skip;

integration("PostgresUnansweredRecorder", () => {
  let environment: TestEnvironment;
  let pool: DatabasePool;
  let recorder: PostgresUnansweredRecorder;

  beforeAll(async () => {
    environment = await startTestEnvironment();
    pool = createDatabasePool(environment.databaseUrl);
    await runMigrations(pool);
    recorder = new PostgresUnansweredRecorder(pool);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await environment?.stop();
  });

  it("atomically inserts interactions and groups normalized recurrences", async () => {
    await recorder.record(interaction("00000000-0000-4000-8000-000000000101", "Primeira forma"));
    await recorder.record(interaction("00000000-0000-4000-8000-000000000102", "Outra forma"));

    const gaps = await pool.query<{
      id: string;
      representative_question: string;
      occurrence_count: number;
    }>(
      `SELECT id, representative_question, occurrence_count
       FROM knowledge_gaps
       WHERE normalized_question = 'como emitir segunda via'`
    );
    const links = await pool.query<{ interaction_id: string }>(
      `SELECT interaction_id
       FROM knowledge_gap_interactions
       WHERE gap_id = $1
       ORDER BY interaction_id`,
      [gaps.rows[0]?.id]
    );

    expect(gaps.rows).toEqual([
      expect.objectContaining({
        representative_question: "Primeira forma",
        occurrence_count: 2
      })
    ]);
    expect(links.rows).toHaveLength(2);
  });

  it("rolls back gap creation when the interaction cannot be inserted", async () => {
    const duplicateId = "00000000-0000-4000-8000-000000000103";
    await recorder.record(interaction(duplicateId, "Pergunta original", "primeiro grupo"));

    await expect(
      recorder.record(interaction(duplicateId, "Pergunta duplicada", "grupo que nao pode existir"))
    ).rejects.toThrow();

    const result = await pool.query<{ count: string }>(
      `SELECT count(*) FROM knowledge_gaps WHERE normalized_question = 'grupo que nao pode existir'`
    );
    expect(result.rows[0]?.count).toBe("0");
  });
});

function interaction(
  id: string,
  rawQuestion: string,
  normalizedQuestion = "como emitir segunda via"
): Interaction {
  return {
    id,
    rawQuestion,
    normalizedQuestion,
    outcome: "unanswered",
    faqId: null,
    categoryId: null,
    answerSnapshot: null,
    sourceAnswerSnapshot: null,
    categorySnapshot: null,
    confidence: null,
    cacheStatus: "miss",
    createdAt: new Date("2026-07-30T12:00:00.000Z")
  };
}
