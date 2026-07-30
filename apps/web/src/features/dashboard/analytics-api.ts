import {
  analyticsSummarySchema,
  type AnalyticsRequest,
  type AnalyticsSummary
} from "@faq/contracts";
import { requestJson } from "../../shared/api/http-client.js";

export function getAnalyticsSummary(range: AnalyticsRequest): Promise<AnalyticsSummary> {
  const query = new URLSearchParams(range);
  return requestJson(`/api/v1/analytics/summary?${query.toString()}`, {
    method: "GET",
    schema: analyticsSummarySchema
  });
}
