import {
  errorEnvelopeSchema,
  gapResolutionSchema,
  knowledgeGapSchema,
  knowledgeGapPageSchema,
  type KnowledgeGapDetails
} from "@faq/contracts";
import { describe, expect, it } from "vitest";
import { buildApplication } from "../../src/bootstrap/build-application.js";

describe("knowledge gap HTTP contract", () => {
  it("rejects anonymous inbox access", async () => {
    const app = await buildApplication({ mode: "test" });
    const response = await app.inject({ method: "GET", url: "/api/v1/knowledge-gaps" });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("returns a validated empty inbox for an administrator", async () => {
    const app = await buildApplication({ mode: "test" });
    const auth = await login(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/knowledge-gaps?page=1&pageSize=20&status=open",
      headers: { cookie: auth.cookie }
    });

    expect(response.statusCode).toBe(200);
    expect(knowledgeGapPageSchema.parse(response.json())).toEqual({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0
    });
    await app.close();
  });

  it("validates inbox filters and returns stable missing-detail errors", async () => {
    const app = await buildApplication({ mode: "test" });
    const auth = await login(app);
    const invalid = await app.inject({
      method: "GET",
      url: "/api/v1/knowledge-gaps?from=2026-08-01&to=2026-07-01",
      headers: { cookie: auth.cookie }
    });
    const missing = await app.inject({
      method: "GET",
      url: "/api/v1/knowledge-gaps/00000000-0000-4000-8000-000000000999",
      headers: { cookie: auth.cookie }
    });

    expect(errorEnvelopeSchema.parse(invalid.json()).code).toBe("VALIDATION_ERROR");
    expect(errorEnvelopeSchema.parse(missing.json())).toMatchObject({
      code: "KNOWLEDGE_GAP_NOT_FOUND"
    });
    await app.close();
  });

  it("accepts an idempotent prefilled resolution and leaves it pending for embedding", async () => {
    const knowledgeGap: KnowledgeGapDetails = {
      id: "00000000-0000-4000-8000-000000000101",
      representativeQuestion: "Como emitir a segunda via?",
      status: "open",
      occurrenceCount: 2,
      firstOccurredAt: "2026-07-29T12:00:00.000Z",
      lastOccurredAt: "2026-07-30T12:00:00.000Z",
      version: 2,
      createdAt: "2026-07-29T12:00:00.000Z",
      updatedAt: "2026-07-30T12:00:00.000Z",
      occurrences: [],
      events: []
    };
    const app = await buildApplication({
      mode: "test",
      testOverrides: { knowledgeGap }
    });
    const auth = await login(app);
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/knowledge-gaps/${knowledgeGap.id}/resolutions`,
      headers: { ...auth, "idempotency-key": "resolution-request-1" },
      payload: {
        mode: "create",
        categoryId: "00000000-0000-4000-8000-000000000010",
        question: knowledgeGap.representativeQuestion,
        aliases: ["Como consigo outra via?"],
        answer: "Acesse Financeiro e selecione 2ª via.",
        expectedVersion: knowledgeGap.version
      }
    });

    expect(response.statusCode).toBe(202);
    expect(gapResolutionSchema.parse(response.json())).toMatchObject({
      knowledgeGapId: knowledgeGap.id,
      mode: "create",
      faqStatus: "embedding_pending",
      status: "pending"
    });
    await app.close();
  });

  it("dismisses and reopens a gap through protected idempotent actions", async () => {
    const knowledgeGap = openKnowledgeGap();
    const app = await buildApplication({
      mode: "test",
      testOverrides: { knowledgeGap }
    });
    const auth = await login(app);
    const dismissedResponse = await app.inject({
      method: "POST",
      url: `/api/v1/knowledge-gaps/${knowledgeGap.id}/dismiss`,
      headers: { ...auth, "idempotency-key": "dismiss-request-1" },
      payload: {
        reason: "Não pertence ao escopo do atendimento.",
        expectedVersion: knowledgeGap.version
      }
    });

    expect(dismissedResponse.statusCode).toBe(200);
    const dismissed = knowledgeGapSchema.parse(dismissedResponse.json());
    expect(dismissed).toMatchObject({ status: "dismissed", version: 3 });

    const reopenedResponse = await app.inject({
      method: "POST",
      url: `/api/v1/knowledge-gaps/${knowledgeGap.id}/reopen`,
      headers: { ...auth, "idempotency-key": "reopen-request-1" },
      payload: {
        reason: "A dúvida voltou a ser relevante.",
        expectedVersion: dismissed.version
      }
    });

    expect(reopenedResponse.statusCode).toBe(200);
    expect(knowledgeGapSchema.parse(reopenedResponse.json())).toMatchObject({
      status: "open",
      version: 4
    });
    await app.close();
  });
});

function openKnowledgeGap(): KnowledgeGapDetails {
  return {
    id: "00000000-0000-4000-8000-000000000101",
    representativeQuestion: "Como emitir a segunda via?",
    status: "open",
    occurrenceCount: 2,
    firstOccurredAt: "2026-07-29T12:00:00.000Z",
    lastOccurredAt: "2026-07-30T12:00:00.000Z",
    version: 2,
    createdAt: "2026-07-29T12:00:00.000Z",
    updatedAt: "2026-07-30T12:00:00.000Z",
    occurrences: [],
    events: []
  };
}

async function login(app: Awaited<ReturnType<typeof buildApplication>>) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: "admin@example.com", password: "change-this-password" }
  });
  const value = response.headers["set-cookie"];
  return {
    cookie: Array.isArray(value) ? value[0]! : value!,
    "x-csrf-token": String(response.headers["x-csrf-token"])
  };
}
