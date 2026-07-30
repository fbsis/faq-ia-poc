import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDatabasePool,
  type DatabasePool
} from "../../../src/infrastructure/database/client.js";
import { runMigrations } from "../../../src/infrastructure/database/migrate.js";
import { AskQuestion } from "../../../src/modules/chat/application/ask-question.js";
import type {
  AnswerCache,
  ConversationAgent,
  FaqSearch
} from "../../../src/modules/chat/application/ports.js";
import { PostgresUnansweredRecorder } from "../../../src/modules/knowledge-gaps/adapters/outbound/postgres-unanswered-recorder.js";
import { FixedClock, SequentialIds } from "../../helpers/fakes.js";
import { startTestEnvironment, type TestEnvironment } from "../../helpers/test-environment.js";

const integration = process.env.RUN_INTEGRATION === "true" ? describe : describe.skip;

integration("chat retrieval failures", () => {
  let environment: TestEnvironment;
  let pool: DatabasePool;

  beforeAll(async () => {
    environment = await startTestEnvironment();
    pool = createDatabasePool(environment.databaseUrl);
    await runMigrations(pool);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await environment?.stop();
  });

  it("persists deterministic fallback when cache and OpenAI providers fail", async () => {
    const unavailableCache: AnswerCache = {
      get: () => Promise.reject(new Error("cache unavailable")),
      set: () => Promise.reject(new Error("cache unavailable"))
    };
    const noResults: FaqSearch = {
      findExact: () => Promise.resolve(null),
      findSemantic: () => Promise.resolve([]),
      findFullText: () => Promise.resolve([])
    };
    const unavailableConversation: ConversationAgent = {
      routeMessage: () => Promise.reject(new Error("provider unavailable")),
      createGroundedResponse: () => Promise.reject(new Error("provider unavailable")),
      createUnansweredResponse: () => Promise.reject(new Error("provider unavailable"))
    };
    const useCase = new AskQuestion({
      search: noResults,
      cache: unavailableCache,
      interactions: { save: () => Promise.resolve() },
      unanswered: new PostgresUnansweredRecorder(pool),
      embeddings: { embed: () => Promise.reject(new Error("provider unavailable")) },
      conversation: unavailableConversation,
      knowledgeVersion: { current: () => Promise.resolve(1) },
      clock: new FixedClock(),
      ids: new SequentialIds()
    });

    const response = await useCase.execute({ question: "Como concluo esta solicitação?" });

    expect(response).toMatchObject({
      status: "unanswered",
      message:
        "Não sei responder essa pergunta com segurança ainda. Talvez eu precise de mais explicações. Você pode explicar melhor o que está tentando fazer e em qual etapa surgiu a dúvida?"
    });
    const persisted = await pool.query<{ cache_status: string }>(
      "SELECT cache_status FROM interactions WHERE id = $1",
      [response.interactionId]
    );
    expect(persisted.rows[0]?.cache_status).toBe("bypassed");
  });
});
