import { describe, expect, it } from "vitest";
import {
  createKnowledgeGap,
  recordKnowledgeGapOccurrence
} from "../../../src/modules/knowledge-gaps/domain/knowledge-gap.js";

describe("knowledge-gap grouping", () => {
  const firstSeenAt = new Date("2026-07-30T12:00:00.000Z");

  it("creates an open gap for the first normalized occurrence", () => {
    expect(
      createKnowledgeGap({
        id: "00000000-0000-4000-8000-000000000001",
        normalizedQuestion: "como emitir segunda via",
        representativeQuestion: "Como emitir a segunda via?",
        occurredAt: firstSeenAt
      })
    ).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      normalizedQuestion: "como emitir segunda via",
      representativeQuestion: "Como emitir a segunda via?",
      status: "open",
      occurrenceCount: 1,
      firstSeenAt,
      lastSeenAt: firstSeenAt,
      version: 1,
      resolvedFaqId: null
    });
  });

  it("records recurrence without mutating the original gap or representative question", () => {
    const original = createKnowledgeGap({
      id: "00000000-0000-4000-8000-000000000001",
      normalizedQuestion: "como emitir segunda via",
      representativeQuestion: "Como emitir a segunda via?",
      occurredAt: firstSeenAt
    });
    const recurrence = recordKnowledgeGapOccurrence(
      { ...original, status: "resolved", resolvedFaqId: "faq-1" },
      new Date("2026-07-31T14:00:00.000Z")
    );

    expect(recurrence).toMatchObject({
      representativeQuestion: "Como emitir a segunda via?",
      status: "open",
      occurrenceCount: 2,
      version: 2,
      resolvedFaqId: "faq-1"
    });
    expect(recurrence.lastSeenAt.toISOString()).toBe("2026-07-31T14:00:00.000Z");
    expect(original).toMatchObject({ status: "open", occurrenceCount: 1, version: 1 });
  });
});
