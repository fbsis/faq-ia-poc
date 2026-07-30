import { describe, expect, it } from "vitest";
import { analyticsRequestSchema, analyticsSummarySchema } from "./analytics.js";

describe("analytics contracts", () => {
  it("accepts an inclusive date range of at most twelve months", () => {
    expect(analyticsRequestSchema.parse({ from: "2026-01-01", to: "2026-12-31" })).toEqual({
      from: "2026-01-01",
      to: "2026-12-31"
    });
  });

  it("rejects reversed and oversized date ranges", () => {
    expect(analyticsRequestSchema.safeParse({ from: "2026-08-01", to: "2026-07-01" }).success).toBe(
      false
    );
    expect(analyticsRequestSchema.safeParse({ from: "2025-01-01", to: "2026-12-31" }).success).toBe(
      false
    );
  });

  it("validates the complete analytics summary", () => {
    const summary = {
      range: {
        from: "2026-07-01",
        to: "2026-07-31",
        timeZone: "America/Sao_Paulo",
        granularity: "day"
      },
      totalQueries: 12,
      answeredQueries: 8,
      unansweredQueries: 4,
      knowledgeGapBacklog: { open: 2, resolving: 1, resolved: 3, dismissed: 1 },
      topQuestions: [{ question: "Como redefino minha senha?", count: 5 }],
      unansweredQuestions: [
        {
          question: "Como altero meu cadastro?",
          count: 3,
          lastOccurredAt: "2026-07-30T12:00:00.000Z"
        }
      ],
      categoryDistribution: [
        {
          categoryId: "00000000-0000-4000-8000-000000000001",
          categoryName: "Conta",
          count: 8
        },
        { categoryName: "Sem categoria", count: 4 }
      ],
      timeline: [{ date: "2026-07-30", count: 12 }]
    };

    expect(analyticsSummarySchema.parse(summary)).toEqual(summary);
  });
});
