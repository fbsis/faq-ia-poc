import { describe, expect, it } from "vitest";
import {
  dismissKnowledgeGapInputSchema,
  knowledgeGapDetailsSchema,
  knowledgeGapListQuerySchema,
  knowledgeGapPageSchema,
  reopenKnowledgeGapInputSchema,
  resolveKnowledgeGapInputSchema
} from "./knowledge-gaps.js";

const gap = {
  id: "00000000-0000-4000-8000-000000000101",
  representativeQuestion: "Como emitir a segunda via?",
  status: "open",
  occurrenceCount: 2,
  firstOccurredAt: "2026-07-29T12:00:00.000Z",
  lastOccurredAt: "2026-07-30T12:00:00.000Z",
  version: 2,
  createdAt: "2026-07-29T12:00:00.000Z",
  updatedAt: "2026-07-30T12:00:00.000Z"
};

describe("knowledge gap contracts", () => {
  it("applies inbox defaults and accepts filters", () => {
    expect(knowledgeGapListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      sort: "occurrences_desc"
    });
    expect(
      knowledgeGapListQuerySchema.parse({
        page: "2",
        pageSize: "10",
        status: "open",
        from: "2026-07-01",
        to: "2026-07-31",
        sort: "latest_desc"
      })
    ).toMatchObject({ page: 2, pageSize: 10, status: "open", sort: "latest_desc" });
  });

  it("rejects incomplete and reversed inbox date ranges", () => {
    expect(() => knowledgeGapListQuerySchema.parse({ from: "2026-07-01" })).toThrow();
    expect(() =>
      knowledgeGapListQuerySchema.parse({ from: "2026-08-01", to: "2026-07-01" })
    ).toThrow();
  });

  it("parses a page and occurrence details with append-only events", () => {
    expect(
      knowledgeGapPageSchema.parse({ items: [gap], page: 1, pageSize: 20, total: 1 })
    ).toMatchObject({ total: 1 });
    expect(
      knowledgeGapDetailsSchema.parse({
        ...gap,
        occurrences: [
          {
            interactionId: "00000000-0000-4000-8000-000000000201",
            question: "Como pego outra via?",
            occurredAt: "2026-07-30T12:00:00.000Z"
          }
        ],
        events: [
          {
            id: "00000000-0000-4000-8000-000000000301",
            type: "reopened",
            fromStatus: "dismissed",
            toStatus: "open",
            adminId: "00000000-0000-4000-8000-000000000001",
            reason: "A dúvida voltou a ocorrer.",
            createdAt: "2026-07-30T13:00:00.000Z"
          }
        ]
      }).events
    ).toHaveLength(1);
  });

  it("validates resolution, dismissal, and reopening commands", () => {
    const baseResolution = {
      categoryId: "00000000-0000-4000-8000-000000000010",
      question: "Como emitir a segunda via?",
      answer: "Abra a área de documentos.",
      expectedVersion: 2
    };
    expect(resolveKnowledgeGapInputSchema.parse({ ...baseResolution, mode: "create" })).toMatchObject(
      { mode: "create", aliases: [] }
    );
    expect(() =>
      resolveKnowledgeGapInputSchema.parse({ ...baseResolution, mode: "update" })
    ).toThrow();
    expect(
      dismissKnowledgeGapInputSchema.parse({
        reason: "Não pertence ao escopo atendido.",
        expectedVersion: 2
      })
    ).toBeDefined();
    expect(reopenKnowledgeGapInputSchema.parse({ expectedVersion: 3 })).toEqual({
      expectedVersion: 3
    });
  });
});
