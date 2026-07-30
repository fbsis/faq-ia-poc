import { Queue, QueueEvents, Worker } from "bullmq";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDatabasePool,
  type DatabasePool
} from "../../../src/infrastructure/database/client.js";
import { runMigrations } from "../../../src/infrastructure/database/migrate.js";
import { createQueueRedis } from "../../../src/infrastructure/redis/connections.js";
import { processFaqEmbedding } from "../../../src/infrastructure/queue/process-faq-embedding.js";
import { PostgresFaqRepository } from "../../../src/modules/faq/adapters/outbound/postgres-faq-repository.js";
import { PostgresKnowledgeGapRepository } from "../../../src/modules/knowledge-gaps/adapters/outbound/postgres-knowledge-gap-repository.js";
import { PostgresUnansweredRecorder } from "../../../src/modules/knowledge-gaps/adapters/outbound/postgres-unanswered-recorder.js";
import type { Interaction } from "../../../src/modules/chat/domain/interaction.js";
import { startTestEnvironment, type TestEnvironment } from "../../helpers/test-environment.js";

const integration = process.env.RUN_INTEGRATION === "true" ? describe : describe.skip;
const adminId = "00000000-0000-4000-8000-000000000001";
const categoryId = "00000000-0000-4000-8000-000000000010";

integration("knowledge-gap resolution worker", () => {
  let environment: TestEnvironment;
  let pool: DatabasePool;
  let gaps: PostgresKnowledgeGapRepository;
  let faqs: PostgresFaqRepository;
  let sequence = 10_000;

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
    gaps = new PostgresKnowledgeGapRepository(pool);
    faqs = new PostgresFaqRepository(pool);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await environment?.stop();
  });

  it("completes once, ignores duplicate execution, reopens recurrence, and preserves history", async () => {
    const fixture = await createPendingResolution("Como emitir comprovante?");
    await runJob(fixture.payload, {
      embed: async () => Array.from({ length: 1_536 }, () => 0)
    });

    const completed = await gaps.get(fixture.gapId);
    expect(completed).toMatchObject({
      status: "resolved",
      currentResolution: { status: "completed", faqStatus: "active" }
    });
    expect(completed?.events.map((event) => event.type)).toEqual([
      "resolution_started",
      "resolved"
    ]);
    expect(await interactionOutcome(fixture.interactionId)).toBe("unanswered");
    const knowledgeVersion = await currentKnowledgeVersion();

    await runJob(fixture.payload, {
      embed: async () => Array.from({ length: 1_536 }, () => 1)
    });

    expect(await currentKnowledgeVersion()).toBe(knowledgeVersion);
    expect(await eventCount(fixture.gapId, "resolved")).toBe(1);

    await new PostgresUnansweredRecorder(pool).record(
      interaction(
        uuid(sequence++),
        "Outra forma da mesma pergunta",
        fixture.normalizedQuestion,
        new Date("2026-07-31T12:00:00.000Z")
      )
    );
    const recurrent = await gaps.get(fixture.gapId);
    expect(recurrent).toMatchObject({ status: "open", occurrenceCount: 2 });
    expect(await interactionOutcome(fixture.interactionId)).toBe("unanswered");
    expect(await eventCount(fixture.gapId, "resolved")).toBe(1);
  });

  it("returns the gap to open after exhausted failure with one atomic audit event", async () => {
    const fixture = await createPendingResolution("Como cancelar uma cobrança?");
    await runJob(
      fixture.payload,
      {
        embed: async () => {
          throw Object.assign(new Error("provider timeout"), { transient: true });
        }
      },
      async (message) => {
        await faqs.failEmbedding(
          fixture.payload.faqId,
          fixture.payload.contentVersion,
          message,
          fixture.payload.resolutionId
        );
      }
    );

    const failed = await gaps.get(fixture.gapId);
    expect(failed).toMatchObject({
      status: "open",
      currentResolution: {
        status: "failed",
        faqStatus: "embedding_failed",
        errorCode: "EMBEDDING_FAILED"
      }
    });
    expect(failed?.events.map((event) => event.type)).toEqual([
      "resolution_started",
      "resolution_failed"
    ]);
    expect(await interactionOutcome(fixture.interactionId)).toBe("unanswered");
  });

  it("treats a stale content version as a harmless no-op", async () => {
    const fixture = await createPendingResolution("Como atualizar meus dados?");
    await pool.query(
      `UPDATE faqs
       SET content_version = content_version + 1
       WHERE id = $1`,
      [fixture.payload.faqId]
    );

    await runJob(fixture.payload, {
      embed: async () => Array.from({ length: 1_536 }, () => 0)
    });

    expect(await gaps.get(fixture.gapId)).toMatchObject({
      status: "resolving",
      currentResolution: { status: "pending", faqStatus: "embedding_pending" }
    });
    expect(await eventCount(fixture.gapId, "resolved")).toBe(0);
  });

  async function createPendingResolution(question: string) {
    const interactionId = uuid(sequence++);
    const normalizedQuestion = `gap-${sequence}`;
    await new PostgresUnansweredRecorder(pool).record(
      interaction(
        interactionId,
        question,
        normalizedQuestion,
        new Date("2026-07-30T12:00:00.000Z")
      )
    );
    const gap = (
      await gaps.list({ page: 1, pageSize: 100, status: "open", sort: "latest_desc" })
    ).items.find((item) => item.representativeQuestion === question)!;
    const seed = sequence++;
    const resolution = await gaps.resolve({
      knowledgeGapId: gap.id,
      adminId,
      resolutionId: uuid(seed),
      faqId: uuid(seed + 100_000),
      eventId: uuid(seed + 200_000),
      outboxId: uuid(seed + 300_000),
      idempotencyKey: `worker-resolution-${seed}`,
      input: {
        mode: "create",
        categoryId,
        question,
        aliases: [],
        answer: "Resposta aprovada.",
        expectedVersion: gap.version
      },
      createdAt: new Date("2026-07-30T13:00:00.000Z")
    });
    return {
      gapId: gap.id,
      interactionId,
      normalizedQuestion,
      payload: {
        faqId: resolution.faqId,
        contentVersion: 1,
        resolutionId: resolution.id
      }
    };
  }

  async function runJob(
    payload: { faqId: string; contentVersion: number; resolutionId?: string },
    embeddings: { embed(text: string): Promise<number[]> },
    onExhausted?: (message: string) => Promise<void>
  ) {
    const name = `resolution-worker-${sequence++}`;
    const prefix = `faq-test-${sequence++}`;
    const queueConnection = createQueueRedis(environment.queueRedisUrl);
    const workerConnection = createQueueRedis(environment.queueRedisUrl);
    const eventsConnection = createQueueRedis(environment.queueRedisUrl);
    const queue = new Queue(name, { connection: queueConnection, prefix });
    const events = new QueueEvents(name, { connection: eventsConnection, prefix });
    let completeExhausted: (() => void) | undefined;
    const exhausted = onExhausted
      ? new Promise<void>((resolve) => {
          completeExhausted = resolve;
        })
      : Promise.resolve();
    const worker = new Worker(
      name,
      (job) => processFaqEmbedding(job.data, faqs, embeddings),
      { connection: workerConnection, prefix }
    );
    if (onExhausted) {
      worker.on("failed", (_, error) => {
        void onExhausted(error.message).then(() => completeExhausted?.());
      });
    }
    try {
      await Promise.all([worker.waitUntilReady(), events.waitUntilReady()]);
      const job = await queue.add("prepare-faq-embedding", payload, {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false
      });
      await job.waitUntilFinished(events).catch(() => undefined);
      await exhausted;
    } finally {
      await Promise.allSettled([worker.close(), events.close(), queue.close()]);
      await Promise.allSettled([
        queueConnection.quit(),
        workerConnection.quit(),
        eventsConnection.quit()
      ]);
    }
  }

  async function interactionOutcome(id: string) {
    return (
      await pool.query<{ outcome: string }>("SELECT outcome FROM interactions WHERE id = $1", [id])
    ).rows[0]!.outcome;
  }

  async function currentKnowledgeVersion() {
    return Number(
      (await pool.query<{ version: string }>("SELECT version FROM knowledge_base_state")).rows[0]!
        .version
    );
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

function interaction(
  id: string,
  rawQuestion: string,
  normalizedQuestion: string,
  createdAt: Date
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
    createdAt
  };
}

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
}
