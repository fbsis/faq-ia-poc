import type { KnowledgeGap } from "@faq/contracts";
import { describe, expect, it, vi } from "vitest";
import { DismissKnowledgeGap } from "../../../src/modules/knowledge-gaps/application/dismiss-knowledge-gap.js";
import { ReopenKnowledgeGap } from "../../../src/modules/knowledge-gaps/application/reopen-knowledge-gap.js";
import { FixedClock, SequentialIds } from "../../helpers/fakes.js";

const gap: KnowledgeGap = {
  id: "00000000-0000-4000-8000-000000000101",
  representativeQuestion: "Como emitir a segunda via?",
  status: "dismissed",
  occurrenceCount: 2,
  firstOccurredAt: "2026-07-29T12:00:00.000Z",
  lastOccurredAt: "2026-07-30T12:00:00.000Z",
  version: 3,
  createdAt: "2026-07-29T12:00:00.000Z",
  updatedAt: "2026-07-30T12:00:00.000Z"
};

describe("knowledge gap actions", () => {
  it("dismisses an open gap with an audited reason", async () => {
    const repository = { dismiss: vi.fn(async () => gap) };
    const useCase = new DismissKnowledgeGap(
      repository,
      new SequentialIds(),
      new FixedClock()
    );

    await expect(
      useCase.execute({
        knowledgeGapId: gap.id,
        adminId: "00000000-0000-4000-8000-000000000001",
        idempotencyKey: "dismiss-request-1",
        input: { reason: "Não pertence ao escopo do atendimento.", expectedVersion: 2 }
      })
    ).resolves.toEqual(gap);
    expect(repository.dismiss).toHaveBeenCalledWith({
      knowledgeGapId: gap.id,
      adminId: "00000000-0000-4000-8000-000000000001",
      eventId: "00000000-0000-4000-8000-000000000001",
      idempotencyKey: "dismiss-request-1",
      input: { reason: "Não pertence ao escopo do atendimento.", expectedVersion: 2 },
      createdAt: new Date("2026-07-30T12:00:00.000Z")
    });
  });

  it("reopens a dismissed gap without deleting its audit history", async () => {
    const reopened = { ...gap, status: "open" as const, version: 4 };
    const repository = { reopen: vi.fn(async () => reopened) };
    const useCase = new ReopenKnowledgeGap(repository, new SequentialIds(), new FixedClock());

    await expect(
      useCase.execute({
        knowledgeGapId: gap.id,
        adminId: "00000000-0000-4000-8000-000000000001",
        idempotencyKey: "reopen-request-1",
        input: { reason: "A dúvida voltou a ser relevante.", expectedVersion: 3 }
      })
    ).resolves.toEqual(reopened);
    expect(repository.reopen).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "00000000-0000-4000-8000-000000000001",
        input: { reason: "A dúvida voltou a ser relevante.", expectedVersion: 3 }
      })
    );
  });
});
