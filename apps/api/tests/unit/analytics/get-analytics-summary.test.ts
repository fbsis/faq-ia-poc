import { describe, expect, it } from "vitest";
import { GetAnalyticsSummary } from "../../../src/modules/analytics/application/get-analytics-summary.js";
import type {
  AnalyticsQuery,
  AnalyticsRepository
} from "../../../src/modules/analytics/application/ports.js";

const emptyMetrics = {
  totalQueries: 0,
  answeredQueries: 0,
  unansweredQueries: 0,
  knowledgeGapBacklog: { open: 0, resolving: 0, resolved: 0, dismissed: 0 },
  topQuestions: [],
  unansweredQuestions: [],
  categoryDistribution: [],
  timeline: []
};

class AnalyticsRepositoryFake implements AnalyticsRepository {
  query: AnalyticsQuery | null = null;

  getSummary(query: AnalyticsQuery) {
    this.query = query;
    return Promise.resolve(emptyMetrics);
  }
}

describe("GetAnalyticsSummary", () => {
  it("queries short periods by day in the configured organization time zone", async () => {
    const repository = new AnalyticsRepositoryFake();
    const useCase = new GetAnalyticsSummary(repository, "America/Sao_Paulo");

    const result = await useCase.execute({ from: "2026-07-01", to: "2026-07-31" });

    expect(repository.query).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
      timeZone: "America/Sao_Paulo",
      granularity: "day"
    });
    expect(result.range).toEqual(repository.query);
  });

  it("uses monthly granularity for longer periods", async () => {
    const repository = new AnalyticsRepositoryFake();
    const useCase = new GetAnalyticsSummary(repository, "America/Sao_Paulo");

    await useCase.execute({ from: "2026-01-01", to: "2026-12-31" });

    expect(repository.query?.granularity).toBe("month");
  });

  it("rejects invalid ranges and invalid IANA time zones before querying", async () => {
    const repository = new AnalyticsRepositoryFake();

    await expect(
      new GetAnalyticsSummary(repository, "America/Sao_Paulo").execute({
        from: "2026-08-01",
        to: "2026-07-01"
      })
    ).rejects.toThrow(/date range/i);
    await expect(
      new GetAnalyticsSummary(repository, "Invalid/Zone").execute({
        from: "2026-07-01",
        to: "2026-07-31"
      })
    ).rejects.toThrow(/time zone/i);
    expect(repository.query).toBeNull();
  });
});
