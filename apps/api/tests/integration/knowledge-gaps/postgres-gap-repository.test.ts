import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDatabasePool,
  type DatabasePool
} from "../../../src/infrastructure/database/client.js";
import { runMigrations } from "../../../src/infrastructure/database/migrate.js";
import { PostgresKnowledgeGapRepository } from "../../../src/modules/knowledge-gaps/adapters/outbound/postgres-knowledge-gap-repository.js";
import { PostgresUnansweredRecorder } from "../../../src/modules/knowledge-gaps/adapters/outbound/postgres-unanswered-recorder.js";
import type { Interaction } from "../../../src/modules/chat/domain/interaction.js";
import { startTestEnvironment, type TestEnvironment } from "../../helpers/test-environment.js";

const integration = process.env.RUN_INTEGRATION === "true" ? describe : describe.skip;

integration("PostgresKnowledgeGapRepository", () => {
  let environment: TestEnvironment;
  let pool: DatabasePool;
  let repository: PostgresKnowledgeGapRepository;

  beforeAll(async () => {
    environment = await startTestEnvironment();
    pool = createDatabasePool(environment.databaseUrl);
    await runMigrations(pool);
    const recorder = new PostgresUnansweredRecorder(pool);
    await recorder.record(interaction("00000000-0000-4000-8000-000000000101", "Primeira forma"));
    await recorder.record(interaction("00000000-0000-4000-8000-000000000102", "Segunda forma"));
    repository = new PostgresKnowledgeGapRepository(pool);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await environment?.stop();
  });

  it("lists filtered gaps using derived occurrence totals", async () => {
    await pool.query("UPDATE knowledge_gaps SET occurrence_count = 99");

    const result = await repository.list({
      page: 1,
      pageSize: 20,
      status: "open",
      sort: "occurrences_desc"
    });

    expect(result).toMatchObject({ total: 1 });
    expect(result.items[0]).toMatchObject({
      representativeQuestion: "Primeira forma",
      status: "open",
      occurrenceCount: 2
    });
  });

  it("returns chronological occurrences and append-only events", async () => {
    const gapId = (
      await pool.query<{ id: string }>(
        "SELECT id FROM knowledge_gaps WHERE normalized_question = $1",
        ["como emitir segunda via"]
      )
    ).rows[0]!.id;
    await pool.query(
      `INSERT INTO knowledge_gap_events
       (gap_id, event_type, reason, created_at)
       VALUES ($1, 'reopened', 'A dúvida voltou a ocorrer.', $2)`,
      [gapId, new Date("2026-07-30T13:00:00.000Z")]
    );

    const result = await repository.get(gapId);

    expect(result?.occurrences.map((item) => item.question)).toEqual([
      "Primeira forma",
      "Segunda forma"
    ]);
    expect(result?.events).toEqual([
      expect.objectContaining({ type: "reopened", reason: "A dúvida voltou a ocorrer." })
    ]);
  });
});

function interaction(id: string, rawQuestion: string): Interaction {
  return {
    id,
    rawQuestion,
    normalizedQuestion: "como emitir segunda via",
    outcome: "unanswered",
    faqId: null,
    categoryId: null,
    answerSnapshot: null,
    sourceAnswerSnapshot: null,
    categorySnapshot: null,
    confidence: null,
    cacheStatus: "miss",
    createdAt: new Date(
      id.endsWith("101") ? "2026-07-29T12:00:00.000Z" : "2026-07-30T12:00:00.000Z"
    )
  };
}
