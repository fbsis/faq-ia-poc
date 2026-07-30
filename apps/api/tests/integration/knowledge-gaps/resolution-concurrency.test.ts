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
const adminId = "00000000-0000-4000-8000-000000000001";
const categoryId = "00000000-0000-4000-8000-000000000010";

integration("knowledge-gap resolution concurrency", () => {
  let environment: TestEnvironment;
  let pool: DatabasePool;
  let repository: PostgresKnowledgeGapRepository;
  let sequence = 100;

  beforeAll(async () => {
    environment = await startTestEnvironment();
    pool = createDatabasePool(environment.databaseUrl);
    await runMigrations(pool);
    await pool.query(
      `INSERT INTO administrators (id, email, display_name, password_hash)
       VALUES ($1, 'admin@example.com', 'FAQ Admin', 'hash')`,
      [adminId]
    );
    await pool.query(
      `INSERT INTO categories (id, name, slug)
       VALUES ($1, 'Financeiro', 'financeiro')`,
      [categoryId]
    );
    repository = new PostgresKnowledgeGapRepository(pool);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await environment?.stop();
  });

  it("replays concurrent requests that use the same idempotency key and request hash", async () => {
    const gap = await createGap("Como emitir recibo?");
    const first = resolutionCommand(gap.id, gap.version, sequence++, "same-resolution-key");
    const second = {
      ...resolutionCommand(gap.id, gap.version, sequence++, "same-resolution-key"),
      input: first.input
    };

    const [left, right] = await Promise.all([
      repository.resolve(first),
      repository.resolve(second)
    ]);

    expect(right).toEqual(left);
    await expectCounts(gap.id, { resolutions: 1, events: 1, outbox: 1 });
  });

  it("rejects a reused key with a different request and rolls back every side effect", async () => {
    const gap = await createGap("Como altero meu endereço?");
    const first = resolutionCommand(gap.id, gap.version, sequence++, "conflicting-resolution-key");
    const conflicting = {
      ...resolutionCommand(gap.id, gap.version, sequence++, "conflicting-resolution-key"),
      input: { ...first.input, answer: "Uma resposta diferente." }
    };

    const results = await Promise.allSettled([
      repository.resolve(first),
      repository.resolve(conflicting)
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "KNOWLEDGE_GAP_IDEMPOTENCY_CONFLICT", statusCode: 409 }
    });
    await expectCounts(gap.id, { resolutions: 1, events: 1, outbox: 1 });
  });

  it("accepts only one concurrent transition for different keys at the same version", async () => {
    const gap = await createGap("Como cancelo uma cobrança?");

    const results = await Promise.allSettled([
      repository.resolve(
        resolutionCommand(gap.id, gap.version, sequence++, "different-resolution-key-a")
      ),
      repository.resolve(
        resolutionCommand(gap.id, gap.version, sequence++, "different-resolution-key-b")
      )
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "KNOWLEDGE_GAP_VERSION_CONFLICT", statusCode: 409 }
    });
    await expectCounts(gap.id, { resolutions: 1, events: 1, outbox: 1 });
  });

  it("deduplicates concurrent dismissals and rejects a competing action", async () => {
    const replayGap = await createGap("Pergunta duplicada para descarte");
    const command = dismissCommand(replayGap.id, replayGap.version, sequence++, "same-dismiss-key");
    const [left, right] = await Promise.all([
      repository.dismiss(command),
      repository.dismiss({
        ...dismissCommand(replayGap.id, replayGap.version, sequence++, "same-dismiss-key"),
        input: command.input
      })
    ]);

    expect(right).toEqual(left);
    expect(await eventCount(replayGap.id, "dismissed")).toBe(1);

    const competingGap = await createGap("Pergunta concorrente para descarte");
    const competing = await Promise.allSettled([
      repository.dismiss(
        dismissCommand(competingGap.id, competingGap.version, sequence++, "different-dismiss-key-a")
      ),
      repository.dismiss(
        dismissCommand(competingGap.id, competingGap.version, sequence++, "different-dismiss-key-b")
      )
    ]);
    expect(competing.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(competing.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "KNOWLEDGE_GAP_VERSION_CONFLICT", statusCode: 409 }
    });
    expect(await eventCount(competingGap.id, "dismissed")).toBe(1);
  });

  async function createGap(question: string) {
    const id = uuid(sequence++);
    await new PostgresUnansweredRecorder(pool).record(interaction(id, question));
    const result = await pool.query<{ id: string; version: number }>(
      `SELECT g.id, g.version
       FROM knowledge_gaps g
       JOIN knowledge_gap_interactions link ON link.gap_id = g.id
       WHERE link.interaction_id = $1`,
      [id]
    );
    return result.rows[0]!;
  }

  async function expectCounts(
    gapId: string,
    expected: { resolutions: number; events: number; outbox: number }
  ) {
    const result = await pool.query<{
      resolutions: string;
      events: string;
      outbox: string;
    }>(
      `SELECT
         (SELECT count(*) FROM knowledge_gap_resolutions WHERE gap_id = $1) AS resolutions,
         (SELECT count(*) FROM knowledge_gap_events
            WHERE gap_id = $1 AND event_type = 'resolution_started') AS events,
         (SELECT count(*) FROM outbox_messages o
            JOIN knowledge_gap_resolutions r ON r.faq_id = o.aggregate_id
            WHERE r.gap_id = $1) AS outbox`,
      [gapId]
    );
    expect({
      resolutions: Number(result.rows[0]!.resolutions),
      events: Number(result.rows[0]!.events),
      outbox: Number(result.rows[0]!.outbox)
    }).toEqual(expected);
  }

  async function eventCount(gapId: string, type: string) {
    return Number(
      (
        await pool.query<{ count: string }>(
          "SELECT count(*) FROM knowledge_gap_events WHERE gap_id = $1 AND event_type = $2",
          [gapId, type]
        )
      ).rows[0]!.count
    );
  }
});

function resolutionCommand(gapId: string, version: number, seed: number, idempotencyKey: string) {
  return {
    knowledgeGapId: gapId,
    adminId,
    resolutionId: uuid(seed),
    faqId: uuid(seed + 1_000),
    eventId: uuid(seed + 2_000),
    outboxId: uuid(seed + 3_000),
    idempotencyKey,
    input: {
      mode: "create" as const,
      categoryId,
      question: `Pergunta ${seed}?`,
      aliases: [`Dúvida ${seed}`],
      answer: `Resposta ${seed}.`,
      expectedVersion: version
    },
    createdAt: new Date("2026-07-30T16:00:00.000Z")
  };
}

function dismissCommand(gapId: string, version: number, seed: number, idempotencyKey: string) {
  return {
    knowledgeGapId: gapId,
    adminId,
    eventId: uuid(seed),
    idempotencyKey,
    input: {
      reason: "Fora do escopo atual.",
      expectedVersion: version
    },
    createdAt: new Date("2026-07-30T17:00:00.000Z")
  };
}

function interaction(id: string, rawQuestion: string): Interaction {
  return {
    id,
    rawQuestion,
    normalizedQuestion: rawQuestion.toLocaleLowerCase("pt-BR"),
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

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
}
