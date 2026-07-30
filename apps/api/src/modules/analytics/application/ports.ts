export type AnalyticsGranularity = "day" | "month";

export interface AnalyticsQuery {
  readonly from: string;
  readonly to: string;
  readonly timeZone: string;
  readonly granularity: AnalyticsGranularity;
}

export interface QuestionMetric {
  readonly question: string;
  readonly count: number;
}

export interface AnalyticsMetrics {
  readonly totalQueries: number;
  readonly answeredQueries: number;
  readonly unansweredQueries: number;
  readonly knowledgeGapBacklog: {
    readonly open: number;
    readonly resolving: number;
    readonly resolved: number;
    readonly dismissed: number;
  };
  readonly topQuestions: QuestionMetric[];
  readonly unansweredQuestions: Array<
    QuestionMetric & {
      readonly lastOccurredAt: string;
    }
  >;
  readonly categoryDistribution: Array<{
    readonly categoryId: string | null;
    readonly categoryName: string;
    readonly count: number;
  }>;
  readonly timeline: Array<{
    readonly date: string;
    readonly count: number;
  }>;
}

export interface AnalyticsRepository {
  getSummary(query: AnalyticsQuery): Promise<AnalyticsMetrics>;
}
