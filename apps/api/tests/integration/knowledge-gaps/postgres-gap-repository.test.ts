import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDatabasePool,
  type DatabasePool
} from "../../../src/infrastructure/database/client.js";
import { runMigrations } from "../../../src/infrastructure/database/migrate.js";
import { PostgresKnowledgeGapRepository } from "../../../src/modules/knowledge-gaps/adapters/outbound/postgres-knowledge-gap-repository.js";
import { PostgresUnansweredRecorder } from "../../../src/modules/knowledge-gaps/adapters/outbound/postgres-unanswered-recorder.js";
import type { Interaction } from "../../../src/modules/chat/domain/interaction.js";
import { PostgresFaqRepository } from "../../../src/modules/faq/adapters/outbound/postgres-faq-repository.js";
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
    await pool.query(
      `INSERT INTO administrators (id, email, display_name, password_hash)
       VALUES ($1, 'admin@example.com', 'FAQ Admin', 'hash')`,
      ["00000000-0000-4000-8000-000000000001"]
    );
    await pool.query(
      `INSERT INTO categories (id, name, slug)
       VALUES ($1, 'Financeiro', 'financeiro')`,
      ["00000000-0000-4000-8000-000000000010"]
    );
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

  it("creates a pending FAQ atomically and resolves the gap only after embedding activation", async () => {
    const gap = (await repository.list({ page: 1, pageSize: 20, sort: "latest_desc" })).items[0]!;
    const command = {
      knowledgeGapId: gap.id,
      adminId: "00000000-0000-4000-8000-000000000001",
      resolutionId: "00000000-0000-4000-8000-000000000301",
      faqId: "00000000-0000-4000-8000-000000000302",
      eventId: "00000000-0000-4000-8000-000000000303",
      outboxId: "00000000-0000-4000-8000-000000000304",
      idempotencyKey: "resolution-request-1",
      input: {
        mode: "create",
        categoryId: "00000000-0000-4000-8000-000000000010",
        question: "Como emitir a segunda via?",
        aliases: ["Como consigo outra via?"],
        answer: "Acesse Financeiro e selecione 2ª via.",
        expectedVersion: gap.version
      },
      createdAt: new Date("2026-07-30T13:00:00.000Z")
    };
    const resolution = await repository.resolve(command);

    expect(resolution).toMatchObject({
      knowledgeGapId: gap.id,
      faqId: "00000000-0000-4000-8000-000000000302",
      faqStatus: "embedding_pending",
      status: "pending"
    });
    expect((await repository.get(gap.id))?.status).toBe("resolving");
    expect(
      (
        await pool.query<{ payload: Record<string, unknown> }>(
          "SELECT payload FROM outbox_messages WHERE aggregate_id = $1",
          [resolution.faqId]
        )
      ).rows[0]!.payload
    ).toEqual({
      faqId: resolution.faqId,
      contentVersion: 1,
      resolutionId: resolution.id
    });
    await expect(
      repository.resolve({
        ...command,
        resolutionId: "00000000-0000-4000-8000-000000000401",
        faqId: "00000000-0000-4000-8000-000000000402",
        eventId: "00000000-0000-4000-8000-000000000403",
        outboxId: "00000000-0000-4000-8000-000000000404"
      })
    ).resolves.toEqual(resolution);

    await new PostgresFaqRepository(pool).activateEmbedding(
      resolution.faqId,
      1,
      Array.from({ length: 1_536 }, () => 0),
      resolution.id
    );

    expect(await repository.get(gap.id)).toMatchObject({
      status: "resolved",
      resolvedFaqId: resolution.faqId,
      currentResolution: { status: "completed", faqStatus: "active" },
      events: expect.arrayContaining([
        expect.objectContaining({ type: "resolution_started" }),
        expect.objectContaining({ type: "resolved" })
      ])
    });
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
