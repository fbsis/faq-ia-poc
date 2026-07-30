import { useQuery } from "@tanstack/react-query";
import type { AnalyticsRequest } from "@faq/contracts";
import { getAnalyticsSummary } from "./analytics-api.js";

export function useAnalytics(range: AnalyticsRequest) {
  return useQuery({
    queryKey: ["analytics-summary", range.from, range.to],
    queryFn: () => getAnalyticsSummary(range),
    retry: false
  });
}
