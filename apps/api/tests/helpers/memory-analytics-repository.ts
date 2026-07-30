import type {
  AnalyticsMetrics,
  AnalyticsRepository
} from "../../src/modules/analytics/application/ports.js";

export class MemoryAnalyticsRepository implements AnalyticsRepository {
  getSummary(): Promise<AnalyticsMetrics> {
    return Promise.resolve({
      totalQueries: 0,
      answeredQueries: 0,
      unansweredQueries: 0,
      knowledgeGapBacklog: {
        open: 0,
        resolving: 0,
        resolved: 0,
        dismissed: 0
      },
      topQuestions: [],
      unansweredQuestions: [],
      categoryDistribution: [],
      timeline: []
    });
  }
}
