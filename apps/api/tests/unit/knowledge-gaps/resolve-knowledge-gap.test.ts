import type { GapResolution, ResolveKnowledgeGapInput } from "@faq/contracts";
import { describe, expect, it, vi } from "vitest";
import { ResolveKnowledgeGap } from "../../../src/modules/knowledge-gaps/application/resolve-knowledge-gap.js";
import { RetryGapResolution } from "../../../src/modules/knowledge-gaps/application/retry-gap-resolution.js";
import { FixedClock, SequentialIds } from "../../helpers/fakes.js";

describe("ResolveKnowledgeGap", () => {
  it("creates one idempotent pending resolution command for the selected gap", async () => {
    const resolution: GapResolution = {
      id: "00000000-0000-4000-8000-000000000001",
      knowledgeGapId: "00000000-0000-4000-8000-000000000101",
      mode: "create",
      faqId: "00000000-0000-4000-8000-000000000002",
      faqStatus: "embedding_pending",
      status: "pending",
      createdAt: "2026-07-30T12:00:00.000Z"
    };
    const repository = { resolve: vi.fn(async () => resolution) };
    const useCase = new ResolveKnowledgeGap(repository, new SequentialIds(), new FixedClock());
    const input: ResolveKnowledgeGapInput = {
      mode: "create",
      categoryId: "00000000-0000-4000-8000-000000000010",
      question: "Como emitir a segunda via?",
      aliases: ["Como consigo outra via?"],
      answer: "Acesse Financeiro e selecione 2ª via.",
      expectedVersion: 2
    };

    await expect(
      useCase.execute({
        knowledgeGapId: resolution.knowledgeGapId,
        adminId: "00000000-0000-4000-8000-000000000020",
        idempotencyKey: "resolution-request-1",
        input
      })
    ).resolves.toEqual(resolution);
    expect(repository.resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        knowledgeGapId: resolution.knowledgeGapId,
        resolutionId: "00000000-0000-4000-8000-000000000001",
        faqId: "00000000-0000-4000-8000-000000000002",
        eventId: "00000000-0000-4000-8000-000000000003",
        outboxId: "00000000-0000-4000-8000-000000000004",
        idempotencyKey: "resolution-request-1",
        input,
        createdAt: new Date("2026-07-30T12:00:00.000Z")
      })
    );
  });
});

describe("RetryGapResolution", () => {
  it("creates an audited retry command with fresh identifiers", async () => {
    const resolution: GapResolution = {
      id: "00000000-0000-4000-8000-000000000001",
      knowledgeGapId: "00000000-0000-4000-8000-000000000101",
      mode: "create",
      faqId: "00000000-0000-4000-8000-000000000002",
      faqStatus: "embedding_pending",
      status: "pending",
      createdAt: "2026-07-30T12:00:00.000Z"
    };
    const repository = { retryResolution: vi.fn(async () => resolution) };
    const useCase = new RetryGapResolution(repository, new SequentialIds(), new FixedClock());

    await expect(
      useCase.execute({
        knowledgeGapId: resolution.knowledgeGapId,
        adminId: "00000000-0000-4000-8000-000000000020",
        idempotencyKey: "resolution-retry-1",
        input: { expectedVersion: 4 }
      })
    ).resolves.toEqual(resolution);
    expect(repository.retryResolution).toHaveBeenCalledWith(
      expect.objectContaining({
        resolutionId: "00000000-0000-4000-8000-000000000001",
        eventId: "00000000-0000-4000-8000-000000000002",
        outboxId: "00000000-0000-4000-8000-000000000003",
        idempotencyKey: "resolution-retry-1",
        input: { expectedVersion: 4 }
      })
    );
  });
});
