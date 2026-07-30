import type { AnalyticsRequest, AnalyticsSummary } from "@faq/contracts";
import { useSearchParams } from "react-router-dom";

export function useAnalyticsFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaults = defaultRange();
  const range = {
    from: searchParams.get("from") ?? defaults.from,
    to: searchParams.get("to") ?? defaults.to
  };

  function setRange(nextRange: AnalyticsRequest) {
    setSearchParams(nextRange, { replace: true });
  }

  return { range, setRange };
}

export function toTimelineChartData(
  timeline: AnalyticsSummary["timeline"],
  granularity: AnalyticsSummary["range"]["granularity"]
) {
  return timeline.map((point) => ({
    ...point,
    label:
      granularity === "month"
        ? `${point.date.slice(5, 7)}/${point.date.slice(0, 4)}`
        : `${point.date.slice(8, 10)}/${point.date.slice(5, 7)}`
  }));
}

function defaultRange(): AnalyticsRequest {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from: toDateInput(from), to: toDateInput(to) };
}

function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
