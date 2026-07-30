import type { AnalyticsGranularity, AnalyticsRepository } from "./ports.js";

const DAY_IN_MILLISECONDS = 86_400_000;
const DAILY_GRANULARITY_LIMIT = 62;
const MAX_RANGE_IN_DAYS = 365;

export class GetAnalyticsSummary {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly timeZone: string
  ) {}

  async execute(range: { from: string; to: string }) {
    const days = rangeInDays(range);
    validateTimeZone(this.timeZone);
    const granularity: AnalyticsGranularity = days <= DAILY_GRANULARITY_LIMIT ? "day" : "month";
    const query = { ...range, timeZone: this.timeZone, granularity };
    const metrics = await this.repository.getSummary(query);
    return { range: query, ...metrics };
  }
}

function rangeInDays(range: { from: string; to: string }): number {
  const from = Date.parse(range.from);
  const to = Date.parse(range.to);
  const days = (to - from) / DAY_IN_MILLISECONDS;
  if (!Number.isFinite(days) || days < 0 || days > MAX_RANGE_IN_DAYS) {
    throw new RangeError("Analytics date range is invalid.");
  }
  return days;
}

function validateTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
  } catch {
    throw new RangeError("Organization time zone is invalid.");
  }
}
